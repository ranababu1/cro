import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { AssignmentRequest, AssignmentResponse } from '@/lib/types';
import { assignUserToVariation, generateId, isExperimentEligible } from '@/lib/assignment';

// POST /api/assign - Get or create user assignment
export async function POST(request: NextRequest) {
    try {
        const body: AssignmentRequest = await request.json();

        if (!body.experiment_id || !body.user_id) {
            return NextResponse.json(
                { error: 'experiment_id and user_id are required' },
                { status: 400 }
            );
        }

        // Check if assignment already exists
        const existingAssignment = await db.getAssignment(body.experiment_id, body.user_id);
        if (existingAssignment) {
            const variations = await db.getVariations(body.experiment_id);
            const variation = variations.find(v => v.id === existingAssignment.variation_id);

            if (variation) {
                return NextResponse.json({
                    experiment_id: body.experiment_id,
                    variation_id: variation.id,
                    variation_name: variation.name,
                    variation_url: variation.url,
                    assigned: true,
                } as AssignmentResponse);
            }
        }

        // Get experiment and check if it's eligible
        const experiment = await db.getExperiment(body.experiment_id);
        if (!experiment) {
            return NextResponse.json(
                { error: 'Experiment not found' },
                { status: 404 }
            );
        }

        if (!isExperimentEligible(experiment.status, experiment.traffic_allocation)) {
            return NextResponse.json({
                experiment_id: body.experiment_id,
                variation_id: '',
                variation_name: '',
                assigned: false,
            } as AssignmentResponse);
        }

        // Get variations
        const variations = await db.getVariations(body.experiment_id);
        if (variations.length === 0) {
            return NextResponse.json(
                { error: 'No variations found for this experiment' },
                { status: 400 }
            );
        }

        // Assign user to variation
        const assignedVariation = assignUserToVariation(
            body.user_id,
            body.experiment_id,
            experiment.traffic_allocation,
            variations
        );

        if (!assignedVariation) {
            return NextResponse.json({
                experiment_id: body.experiment_id,
                variation_id: '',
                variation_name: '',
                assigned: false,
            } as AssignmentResponse);
        }

        // Save assignment
        await db.createAssignment({
            id: generateId('asn'),
            experiment_id: body.experiment_id,
            variation_id: assignedVariation.id,
            user_id: body.user_id,
        });

        return NextResponse.json({
            experiment_id: body.experiment_id,
            variation_id: assignedVariation.id,
            variation_name: assignedVariation.name,
            variation_url: assignedVariation.url,
            assigned: true,
        } as AssignmentResponse);
    } catch (error) {
        console.error('Failed to assign user:', error);
        return NextResponse.json(
            { error: 'Failed to assign user' },
            { status: 500 }
        );
    }
}
