import { Experiment, Variation, Assignment, Event } from './types';

// Database interface - can be swapped for different implementations
export interface Database {
    query<T = any>(sql: string, params?: any[]): Promise<T[]>;
    execute(sql: string, params?: any[]): Promise<void>;
}

// In-memory database for development (will be replaced with D1 in production)
class InMemoryDatabase implements Database {
    private experiments: Map<string, Experiment> = new Map();
    private variations: Map<string, Variation> = new Map();
    private assignments: Map<string, Assignment> = new Map();
    private events: Event[] = [];

    async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
        const lowerSql = sql.toLowerCase().trim();

        if (lowerSql.startsWith('select')) {
            if (lowerSql.includes('from experiments')) {
                if (lowerSql.includes('where id = ?') && params[0]) {
                    const exp = this.experiments.get(params[0]);
                    return exp ? [exp] as T[] : [];
                }
                return Array.from(this.experiments.values()).sort((a, b) =>
                    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                ) as T[];
            } else if (lowerSql.includes('from variations')) {
                if (lowerSql.includes('where experiment_id = ?') && params[0]) {
                    return Array.from(this.variations.values())
                        .filter(v => v.experiment_id === params[0])
                        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) as T[];
                }
                return Array.from(this.variations.values()) as T[];
            } else if (lowerSql.includes('from assignments')) {
                if (lowerSql.includes('where experiment_id = ? and user_id = ?') && params.length >= 2) {
                    const key = `${params[0]}:${params[1]}`;
                    const assignment = this.assignments.get(key);
                    return assignment ? [assignment] as T[] : [];
                }
                return Array.from(this.assignments.values()) as T[];
            } else if (lowerSql.includes('from events')) {
                if (lowerSql.includes('where experiment_id = ?') && params[0]) {
                    const experimentEvents = this.events.filter(e => e.experiment_id === params[0]);

                    if (lowerSql.includes('group by variation_id')) {
                        // Calculate stats per variation
                        const stats = new Map<string, { total_users: Set<string>, conversions: number }>();

                        for (const event of experimentEvents) {
                            if (!stats.has(event.variation_id)) {
                                stats.set(event.variation_id, { total_users: new Set(), conversions: 0 });
                            }
                            const stat = stats.get(event.variation_id)!;
                            stat.total_users.add(event.user_id);
                            if (event.event_type === 'conversion') {
                                stat.conversions++;
                            }
                        }

                        return Array.from(stats.entries()).map(([variation_id, data]) => ({
                            variation_id,
                            total_users: data.total_users.size,
                            conversions: data.conversions
                        })) as T[];
                    }

                    return experimentEvents as T[];
                }
                return this.events as T[];
            }
        }

        return [];
    }

    async execute(sql: string, params: any[] = []): Promise<void> {
        const lowerSql = sql.toLowerCase().trim();
        const now = new Date().toISOString();

        if (lowerSql.startsWith('insert')) {
            if (lowerSql.includes('into experiments')) {
                const [id, name, description, status, traffic_allocation, started_at, ended_at] = params;
                this.experiments.set(id, {
                    id, name, description, status, traffic_allocation, started_at, ended_at,
                    created_at: now,
                    updated_at: now
                });
            } else if (lowerSql.includes('into variations')) {
                const [id, experiment_id, name, description, url, weight, is_control] = params;
                this.variations.set(id, {
                    id, experiment_id, name, description, url, weight,
                    is_control: !!is_control,
                    created_at: now
                });
            } else if (lowerSql.includes('into assignments')) {
                const [id, experiment_id, variation_id, user_id] = params;
                const key = `${experiment_id}:${user_id}`;
                if (!this.assignments.has(key)) {
                    this.assignments.set(key, {
                        id, experiment_id, variation_id, user_id,
                        assigned_at: now
                    });
                }
            } else if (lowerSql.includes('into events')) {
                const [id, experiment_id, variation_id, user_id, event_type, event_name, metadata] = params;
                this.events.push({
                    id, experiment_id, variation_id, user_id, event_type, event_name, metadata,
                    created_at: now
                });
            }
        } else if (lowerSql.startsWith('update')) {
            if (lowerSql.includes('experiments')) {
                const id = params[params.length - 1];
                const exp = this.experiments.get(id);
                if (exp) {
                    const updates: any = {};
                    const fieldMatches = sql.match(/SET\s+(.+?)\s+WHERE/i);
                    if (fieldMatches) {
                        const fields = fieldMatches[1].split(',').map(f => f.trim().split('=')[0].trim());
                        fields.forEach((field, i) => {
                            if (field !== 'updated_at' && i < params.length - 1) {
                                updates[field] = params[i];
                            }
                        });
                    }
                    this.experiments.set(id, { ...exp, ...updates, updated_at: now });
                }
            }
        } else if (lowerSql.startsWith('delete')) {
            if (lowerSql.includes('from experiments')) {
                const id = params[0];
                this.experiments.delete(id);
                // Also delete related variations, assignments, and events
                for (const [key, variation] of this.variations.entries()) {
                    if (variation.experiment_id === id) {
                        this.variations.delete(key);
                    }
                }
                for (const [key, assignment] of this.assignments.entries()) {
                    if (assignment.experiment_id === id) {
                        this.assignments.delete(key);
                    }
                }
                this.events = this.events.filter(e => e.experiment_id !== id);
            }
        }
    }
}

// Singleton instance
let dbInstance: Database | null = null;

export function getDatabase(): Database {
    if (!dbInstance) {
        // For development, use in-memory database
        // In production with Cloudflare Workers, this will use D1
        if (process.env.NODE_ENV === 'production' && process.env.DB) {
            // Will be replaced with D1 binding
            throw new Error('D1 database not yet configured');
        } else {
            dbInstance = new InMemoryDatabase();
        }
    }
    return dbInstance;
}

// Database operations
export const db = {
    // Experiments
    async getExperiments(): Promise<Experiment[]> {
        const db = getDatabase();
        return db.query<Experiment>('SELECT * FROM experiments ORDER BY created_at DESC');
    },

    async getExperiment(id: string): Promise<Experiment | null> {
        const db = getDatabase();
        const results = await db.query<Experiment>('SELECT * FROM experiments WHERE id = ?', [id]);
        return results[0] || null;
    },

    async createExperiment(experiment: Omit<Experiment, 'created_at' | 'updated_at'>): Promise<void> {
        const db = getDatabase();
        await db.execute(
            'INSERT INTO experiments (id, name, description, status, traffic_allocation, started_at, ended_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [experiment.id, experiment.name, experiment.description, experiment.status, experiment.traffic_allocation, experiment.started_at, experiment.ended_at]
        );
    },

    async updateExperiment(id: string, updates: Partial<Experiment>): Promise<void> {
        const db = getDatabase();
        const fields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
        const values = [...Object.values(updates), id];
        await db.execute(`UPDATE experiments SET ${fields}, updated_at = datetime('now') WHERE id = ?`, values);
    },

    async deleteExperiment(id: string): Promise<void> {
        const db = getDatabase();
        await db.execute('DELETE FROM experiments WHERE id = ?', [id]);
    },

    // Variations
    async getVariations(experimentId: string): Promise<Variation[]> {
        const db = getDatabase();
        return db.query<Variation>('SELECT * FROM variations WHERE experiment_id = ? ORDER BY created_at', [experimentId]);
    },

    async createVariation(variation: Omit<Variation, 'created_at'>): Promise<void> {
        const db = getDatabase();
        await db.execute(
            'INSERT INTO variations (id, experiment_id, name, description, url, weight, is_control) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [variation.id, variation.experiment_id, variation.name, variation.description, variation.url, variation.weight, variation.is_control ? 1 : 0]
        );
    },

    // Assignments
    async getAssignment(experimentId: string, userId: string): Promise<Assignment | null> {
        const db = getDatabase();
        const results = await db.query<Assignment>(
            'SELECT * FROM assignments WHERE experiment_id = ? AND user_id = ?',
            [experimentId, userId]
        );
        return results[0] || null;
    },

    async createAssignment(assignment: Omit<Assignment, 'assigned_at'>): Promise<void> {
        const db = getDatabase();
        await db.execute(
            'INSERT OR IGNORE INTO assignments (id, experiment_id, variation_id, user_id) VALUES (?, ?, ?, ?)',
            [assignment.id, assignment.experiment_id, assignment.variation_id, assignment.user_id]
        );
    },

    // Events
    async createEvent(event: Omit<Event, 'created_at'>): Promise<void> {
        const db = getDatabase();
        await db.execute(
            'INSERT INTO events (id, experiment_id, variation_id, user_id, event_type, event_name, metadata) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [event.id, event.experiment_id, event.variation_id, event.user_id, event.event_type, event.event_name, event.metadata]
        );
    },

    async getEventStats(experimentId: string): Promise<any> {
        const db = getDatabase();
        return db.query(
            `SELECT 
        variation_id,
        COUNT(DISTINCT user_id) as total_users,
        COUNT(CASE WHEN event_type = 'conversion' THEN 1 END) as conversions
      FROM events
      WHERE experiment_id = ?
      GROUP BY variation_id`,
            [experimentId]
        );
    }
};
