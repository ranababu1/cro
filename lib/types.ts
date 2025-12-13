// Database Types

export type ExperimentStatus = 'draft' | 'running' | 'paused' | 'completed';

export interface Experiment {
    id: string;
    name: string;
    description?: string;
    status: ExperimentStatus;
    traffic_allocation: number; // percentage 0-100
    created_at: string;
    updated_at: string;
    started_at?: string;
    ended_at?: string;
}

export interface Variation {
    id: string;
    experiment_id: string;
    name: string;
    description?: string;
    url?: string; // URL to test for this variation
    weight: number; // percentage 0-100, sum should equal 100 within experiment
    is_control: boolean;
    created_at: string;
}

export interface Assignment {
    id: string;
    experiment_id: string;
    variation_id: string;
    user_id: string;
    assigned_at: string;
}

export type EventType = 'page_view' | 'conversion';

export interface Event {
    id: string;
    experiment_id: string;
    variation_id: string;
    user_id: string;
    event_type: EventType;
    event_name?: string;
    metadata?: string; // JSON string
    created_at: string;
}

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
}

export interface TrackEventRequest {
    experiment_id: string;
    variation_id: string;
    user_id: string;
    event_type: EventType;
    event_name?: string;
    metadata?: Record<string, any>;
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
