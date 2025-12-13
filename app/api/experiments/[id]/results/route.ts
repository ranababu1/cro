import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ExperimentResults, VariationMetrics } from '@/lib/types';
import {
    calculateConfidenceInterval,
    calculateStatisticalSignificance,
    calculateLift,
} from '@/lib/statistics';

// GET /api/experiments/[id]/results - Get experiment results with statistics
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

        // Get variations
        const variations = await db.getVariations(id);

        // Get event stats
        const eventStats = await db.getEventStats(id);

        // Build metrics for each variation
        const variationMetrics: VariationMetrics[] = variations.map(variation => {
            const stats = eventStats.find((s: any) => s.variation_id === variation.id) || {
                total_users: 0,
                conversions: 0,
            };

            const totalUsers = stats.total_users || 0;
            const conversions = stats.conversions || 0;
            const conversionRate = totalUsers > 0 ? conversions / totalUsers : 0;

            const confidenceInterval = calculateConfidenceInterval(conversions, totalUsers, 0.95);

            return {
                variation_id: variation.id,
                variation_name: variation.name,
                is_control: variation.is_control,
                total_users: totalUsers,
                conversions: conversions,
                conversion_rate: conversionRate,
                confidence_interval: confidenceInterval,
            };
        });

        // Calculate statistical significance
        const control = variationMetrics.find(v => v.is_control);
        let statisticalSignificance;
        let winner;

        if (control && variationMetrics.length > 1) {
            // Find best performing non-control variation
            const variations_excluding_control = variationMetrics.filter(v => !v.is_control);
            const bestVariation = variations_excluding_control.reduce((best, current) => {
                return current.conversion_rate > best.conversion_rate ? current : best;
            }, variations_excluding_control[0]);

            if (bestVariation) {
                const significance = calculateStatisticalSignificance(
                    {
                        total_users: control.total_users,
                        conversions: control.conversions,
                        conversion_rate: control.conversion_rate,
                    },
                    {
                        total_users: bestVariation.total_users,
                        conversions: bestVariation.conversions,
                        conversion_rate: bestVariation.conversion_rate,
                    }
                );

                statisticalSignificance = significance;

                // Determine winner if significant and variation performs better
                if (significance.is_significant && bestVariation.conversion_rate > control.conversion_rate) {
                    winner = bestVariation.variation_id;
                }
            }
        }

        const totalSampleSize = variationMetrics.reduce((sum, v) => sum + v.total_users, 0);

        const results: ExperimentResults = {
            experiment_id: experiment.id,
            experiment_name: experiment.name,
            status: experiment.status,
            variations: variationMetrics,
            statistical_significance: statisticalSignificance,
            sample_size: totalSampleSize,
            winner: winner,
        };

        return NextResponse.json(results);
    } catch (error) {
        console.error('Failed to fetch experiment results:', error);
        return NextResponse.json(
            { error: 'Failed to fetch experiment results' },
            { status: 500 }
        );
    }
}
