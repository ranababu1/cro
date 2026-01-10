import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { CreateExperimentRequest } from '@/lib/types';
import { generateId, validateVariationWeights } from '@/lib/assignment';

// GET /api/experiments - List experiments for authenticated user
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');

        // If userId is provided (for server-side fetching), use it
        // Otherwise, require authentication
        if (!userId && !session?.user?.id) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const experiments = await db.getExperiments(userId || session!.user.id);
        return NextResponse.json({ experiments });
    } catch (error) {
        console.error('Failed to fetch experiments:', error);
        return NextResponse.json(
            { error: 'Failed to fetch experiments' },
            { status: 500 }
        );
    }
}

// POST /api/experiments - Create a new experiment
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.id) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const body: CreateExperimentRequest = await request.json();

        // Validate request
        if (!body.name || !body.variations || body.variations.length < 2) {
            return NextResponse.json(
                { error: 'Experiment must have a name and at least 2 variations' },
                { status: 400 }
            );
        }

        // Validate variation weights
        if (!validateVariationWeights(body.variations)) {
            return NextResponse.json(
                { error: 'Variation weights must sum to 100' },
                { status: 400 }
            );
        }

        // Ensure exactly one control variation
        const controlCount = body.variations.filter(v => v.is_control).length;
        if (controlCount !== 1) {
            return NextResponse.json(
                { error: 'Exactly one variation must be marked as control' },
                { status: 400 }
            );
        }

        // Create experiment
        const experimentId = generateId('exp');
        await db.createExperiment({
            id: experimentId,
            user_id: session.user.id,
            name: body.name,
            description: body.description,
            status: 'draft',
            traffic_allocation: body.traffic_allocation || 100,
        });

        // Create variations
        for (const variation of body.variations) {
            const variationId = generateId('var');
            await db.createVariation({
                id: variationId,
                experiment_id: experimentId,
                name: variation.name,
                description: variation.description,
                weight: variation.weight,
                is_control: variation.is_control,
            });
        }

        const experiment = await db.getExperiment(experimentId);
        const variations = await db.getVariations(experimentId);

        return NextResponse.json(
            { experiment, variations },
            { status: 201 }
        );
    } catch (error) {
        console.error('Failed to create experiment:', error);
        return NextResponse.json(
            { error: 'Failed to create experiment' },
            { status: 500 }
        );
    }
}
