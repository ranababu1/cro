import type { InferSelectModel } from 'drizzle-orm';
import type * as schema from './db/schema';

// Database Types

export type ExperimentStatus = 'draft' | 'running' | 'paused' | 'completed';


// Row types come from the Drizzle schema so they cannot drift from the database.
export type User = InferSelectModel<typeof schema.users>;
export type Experiment = InferSelectModel<typeof schema.experiments>;
export type Variation = InferSelectModel<typeof schema.variations>;
export type Assignment = InferSelectModel<typeof schema.assignments>;
export type Event = InferSelectModel<typeof schema.events>;
export type EventType = Event['event_type'];

// API Request/Response Types

export interface CreateExperimentRequest {
    name: string;
    description?: string;
    traffic_allocation?: number;
    variations: {
        name: string;
        description?: string;
        url?: string;
        weight: number;
        is_control: boolean;
    }[];
}

export interface UpdateExperimentRequest {
    name?: string;
    description?: string;
    status?: ExperimentStatus;
    traffic_allocation?: number;
}

export interface AssignmentRequest {
    experiment_id: string;
    user_id: string;
}

export interface AssignmentResponse {
    experiment_id: string;
    variation_id: string;
    variation_name: string;
    variation_url?: string;
    assigned: boolean;
    reason?: 'quota_exceeded';
}

export interface TrackEventRequest {
    experiment_id: string;
    variation_id: string;
    user_id: string;
    event_type: EventType;
    event_name?: string;
    metadata?: Record<string, unknown>;
}

// Statistics Types

export interface VariationMetrics {
    variation_id: string;
    variation_name: string;
    is_control: boolean;
    total_users: number;
    conversions: number;
    conversion_rate: number;
    confidence_interval?: {
        lower: number;
        upper: number;
    };
}

export interface ExperimentResults {
    experiment_id: string;
    experiment_name: string;
    status: ExperimentStatus;
    variations: VariationMetrics[];
    statistical_significance?: {
        is_significant: boolean;
        p_value: number;
        confidence_level: number;
    };
    sample_size: number;
    winner?: string; // variation_id if there's a clear winner
}
