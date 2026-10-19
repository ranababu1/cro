import type { VisualChange } from './visualChanges';
import type { InferSelectModel } from 'drizzle-orm';
import type * as schema from './db/schema';

export type ExperimentStatus = 'draft' | 'running' | 'paused' | 'completed';

export type User = InferSelectModel<typeof schema.users>;
export type Experiment = InferSelectModel<typeof schema.experiments>;
export type Variation = InferSelectModel<typeof schema.variations>;
export type Goal = InferSelectModel<typeof schema.goals>;
export type ProjectDomain = InferSelectModel<typeof schema.projectDomains>;
export type Assignment = InferSelectModel<typeof schema.assignments>;
export type Event = InferSelectModel<typeof schema.events>;
export type EventType = Event['event_type'];

export interface CreateExperimentRequest {
    name: string;
    description?: string;
    control_url: string;
    traffic_allocation?: number;
    variations: {
        name: string;
        description?: string;
        url: string;
        weight: number;
        is_control: boolean;
    }[];
    goals: {
        name: string;
        type?: 'click' | 'form' | 'page' | 'event';
        selector: string;
        match_type?: 'equals' | 'contains' | 'regex';
        is_primary: boolean;
    }[];
}

export interface UpdateExperimentRequest {
    name?: string;
    description?: string;
    status?: ExperimentStatus;
    traffic_allocation?: number;
}

export interface AssignmentResponse {
    experiment_id: string;
    variation_id: string;
    variation_name: string;
    variation_url?: string;
    assigned: boolean;
    reason?: 'quota_exceeded' | 'domain_not_allowed' | 'no_match' | 'not_running' | 'plan_required';
}

export interface BootstrapGoal {
    id: string;
    name: string;
    type: 'click' | 'form' | 'page' | 'event';
    selector: string;
    is_primary: boolean;
}

export interface BootstrapResponse {
    matched: boolean;
    action: 'none' | 'stay' | 'redirect' | 'guard';
    /** Present only for orgs entitled to heavy capture features. */
    capture?: { heatmaps: boolean; sample_rate?: number };
    /** Lazy modules the SDK loads for this page, from a fixed list: public/<name>.js. */
    modules?: Array<'errors' | 'popups' | 'surveys'>;
    /** Popups (paid) whose page rule matches this URL; shown by popups.js. */
    popups?: import('./popups').SdkPopup[];
    /** Surveys (paid) whose page rule matches this URL; shown by surveys.js. */
    surveys?: import('./surveys').SdkSurvey[];
    experiment_id?: string;
    variation_id?: string;
    variation_name?: string;
    variation_url?: string;
    is_control?: boolean;
    control_url?: string;
    goals?: BootstrapGoal[];
    /** Visual editor changes for a variation that runs on the control page. Applied by the SDK before the page shows. */
    changes?: VisualChange[];
    reason?: string;
}

export interface VariationMetrics {
    variation_id: string;
    variation_name: string;
    is_control: boolean;
    total_users: number;
    conversions: number;
    conversion_rate: number;
    confidence_interval?: { lower: number; upper: number };
}

export interface GoalResults {
    goal_id: string;
    goal_name: string;
    is_primary: boolean;
    variations: VariationMetrics[];
    statistical_significance?: {
        is_significant: boolean;
        p_value: number;
        confidence_level: number;
        z_score: number;
    };
    winner?: string;
}

export interface ExperimentResults {
    experiment_id: string;
    experiment_name: string;
    status: ExperimentStatus;
    variations: VariationMetrics[];
    goals: GoalResults[];
    statistical_significance?: {
        is_significant: boolean;
        p_value: number;
        confidence_level: number;
        z_score: number;
    };
    sample_size: number;
    winner?: string;
    srm?: {
        p_value: number;
        chi_square: number;
        mismatch: boolean;
        total: number;
        variations: { variation_id: string; variation_name: string; observed: number; expected_share: number }[];
    };
    live?: import('./liveStats').LiveStats;
}
