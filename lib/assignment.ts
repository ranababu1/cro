import { createHash } from 'crypto';
import { Variation } from './types';

/**
 * Deterministic hashing function to assign users to variations
 * Uses MurmurHash3-like algorithm for consistent distribution
 */
export function hashUserToVariation(userId: string, experimentId: string): number {
    // Create a deterministic hash from userId and experimentId
    const hash = createHash('sha256');
    hash.update(`${experimentId}:${userId}`);
    const hashHex = hash.digest('hex');

    // Convert first 8 characters to a number between 0 and 1
    const hashValue = parseInt(hashHex.substring(0, 8), 16);
    const maxValue = 0xffffffff;

    return hashValue / maxValue;
}

/**
 * Assign a user to a variation based on traffic allocation and variation weights
 * @param userId - Unique user identifier
 * @param experimentId - Experiment ID
 * @param trafficAllocation - Percentage of traffic to include (0-100)
 * @param variations - Array of variations with weights
 * @returns The assigned variation or null if user is not in traffic
 */
export function assignUserToVariation(
    userId: string,
    experimentId: string,
    trafficAllocation: number,
    variations: Variation[]
): Variation | null {
    // First check if user is in the traffic allocation
    const trafficHash = hashUserToVariation(userId, `traffic:${experimentId}`);
    const trafficThreshold = trafficAllocation / 100;

    if (trafficHash > trafficThreshold) {
        return null; // User is not in the experiment traffic
    }

    // Calculate cumulative weights
    const totalWeight = variations.reduce((sum, v) => sum + v.weight, 0);

    if (totalWeight === 0) {
        throw new Error('Total variation weight cannot be zero');
    }

    // Get user's hash for variation assignment
    const variationHash = hashUserToVariation(userId, experimentId);

    // Assign to variation based on cumulative weight distribution
    let cumulativeWeight = 0;
    for (const variation of variations) {
        cumulativeWeight += variation.weight / totalWeight;
        if (variationHash <= cumulativeWeight) {
            return variation;
        }
    }

    // Fallback to last variation (should never reach here in practice)
    return variations[variations.length - 1];
}

/**
 * Validate that variation weights sum to 100
 */
export function validateVariationWeights(variations: { weight: number }[]): boolean {
    const totalWeight = variations.reduce((sum, v) => sum + v.weight, 0);
    return Math.abs(totalWeight - 100) < 0.01; // Allow for floating point errors
}

/**
 * Generate a unique ID using timestamp and random string
 */
export function generateId(prefix: string = ''): string {
    const timestamp = Date.now().toString(36);
    const randomStr = Math.random().toString(36).substring(2, 9);
    return prefix ? `${prefix}_${timestamp}_${randomStr}` : `${timestamp}_${randomStr}`;
}

/**
 * Check if an experiment is eligible to assign users
 */
export function isExperimentEligible(
    status: string,
    trafficAllocation: number
): boolean {
    return status === 'running' && trafficAllocation > 0;
}
