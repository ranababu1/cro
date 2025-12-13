import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { TrackEventRequest } from '@/lib/types';
import { generateId } from '@/lib/assignment';

// POST /api/track - Track an event
export async function POST(request: NextRequest) {
    try {
        const body: TrackEventRequest = await request.json();

        // Validate required fields
        if (!body.experiment_id || !body.variation_id || !body.user_id || !body.event_type) {
            return NextResponse.json(
                { error: 'experiment_id, variation_id, user_id, and event_type are required' },
                { status: 400 }
            );
        }

        // Validate event_type
        if (!['page_view', 'conversion'].includes(body.event_type)) {
            return NextResponse.json(
                { error: 'event_type must be either "page_view" or "conversion"' },
                { status: 400 }
            );
        }

        // Verify experiment exists
        const experiment = await db.getExperiment(body.experiment_id);
        if (!experiment) {
            return NextResponse.json(
                { error: 'Experiment not found' },
                { status: 404 }
            );
        }

        // Verify variation exists and belongs to experiment
        const variations = await db.getVariations(body.experiment_id);
        const variation = variations.find(v => v.id === body.variation_id);
        if (!variation) {
            return NextResponse.json(
                { error: 'Variation not found' },
                { status: 404 }
            );
        }

        // Create event
        await db.createEvent({
            id: generateId('evt'),
            experiment_id: body.experiment_id,
            variation_id: body.variation_id,
            user_id: body.user_id,
            event_type: body.event_type,
            event_name: body.event_name,
            metadata: body.metadata ? JSON.stringify(body.metadata) : undefined,
        });

        return NextResponse.json({ success: true }, { status: 201 });
    } catch (error) {
        console.error('Failed to track event:', error);
        return NextResponse.json(
            { error: 'Failed to track event' },
            { status: 500 }
        );
    }
}
