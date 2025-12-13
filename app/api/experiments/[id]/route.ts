import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { UpdateExperimentRequest } from '@/lib/types';

// GET /api/experiments/[id] - Get a specific experiment
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const experiment = await db.getExperiment(id);

        if (!experiment) {
            return NextResponse.json(
                { error: 'Experiment not found' },
                { status: 404 }
            );
        }

        const variations = await db.getVariations(id);

        return NextResponse.json({ experiment, variations });
    } catch (error) {
        console.error('Failed to fetch experiment:', error);
        return NextResponse.json(
            { error: 'Failed to fetch experiment' },
            { status: 500 }
        );
    }
}

// PATCH /api/experiments/[id] - Update an experiment
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body: UpdateExperimentRequest = await request.json();

        const experiment = await db.getExperiment(id);
        if (!experiment) {
            return NextResponse.json(
                { error: 'Experiment not found' },
                { status: 404 }
            );
        }

        // Validate status transitions
        if (body.status) {
            const validTransitions: Record<string, string[]> = {
                draft: ['running'],
                running: ['paused', 'completed'],
                paused: ['running', 'completed'],
                completed: [], // Cannot transition from completed
            };

            const allowedStatuses = validTransitions[experiment.status];
            if (!allowedStatuses.includes(body.status)) {
                return NextResponse.json(
                    { error: `Cannot transition from ${experiment.status} to ${body.status}` },
                    { status: 400 }
                );
            }

            // Set started_at when moving to running
            if (body.status === 'running' && !experiment.started_at) {
                (body as any).started_at = new Date().toISOString();
            }

            // Set ended_at when moving to completed
            if (body.status === 'completed' && !experiment.ended_at) {
                (body as any).ended_at = new Date().toISOString();
            }
        }

        // Update experiment
        await db.updateExperiment(id, body);

        const updatedExperiment = await db.getExperiment(id);
        const variations = await db.getVariations(id);

        return NextResponse.json({ experiment: updatedExperiment, variations });
    } catch (error) {
        console.error('Failed to update experiment:', error);
        return NextResponse.json(
            { error: 'Failed to update experiment' },
            { status: 500 }
        );
    }
}

// DELETE /api/experiments/[id] - Delete an experiment
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const experiment = await db.getExperiment(id);

        if (!experiment) {
            return NextResponse.json(
                { error: 'Experiment not found' },
                { status: 404 }
            );
        }

        // Only allow deletion of draft experiments
        if (experiment.status !== 'draft') {
            return NextResponse.json(
                { error: 'Only draft experiments can be deleted' },
                { status: 400 }
            );
        }

        await db.deleteExperiment(id);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Failed to delete experiment:', error);
        return NextResponse.json(
            { error: 'Failed to delete experiment' },
            { status: 500 }
        );
    }
}
