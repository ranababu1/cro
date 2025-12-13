/**
 * A/B Testing Client SDK
 * Lightweight JavaScript snippet for embedding on client sites
 * 
 * Usage:
 * <script src="https://your-domain.com/sdk.js"></script>
 * <script>
 *   ABTest.init({
 *     apiUrl: 'https://your-domain.com',
 *     userId: 'unique-user-id' // or leave empty for auto-generated
 *   });
 * 
 *   ABTest.getVariation('experiment-id').then(variation => {
 *     if (variation.assigned) {
 *       // Apply variation logic
 *       if (variation.variation_name === 'Variation A') {
 *         // Show variation A
 *       }
 *     }
 *   });
 * 
 *   // Track conversions
 *   ABTest.trackConversion('experiment-id', 'button_click');
 * </script>
 */

(function (window) {
    'use strict';

    // Configuration
    let config = {
        apiUrl: '',
        userId: null,
    };

    // User ID management
    function getUserId() {
        if (config.userId) {
            return config.userId;
        }

        // Check for existing user ID in localStorage
        let userId = localStorage.getItem('ab_user_id');
        if (!userId) {
            // Generate new user ID
            userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substring(2, 11);
            localStorage.setItem('ab_user_id', userId);
        }

        return userId;
    }

    // Cache for assignments
    const assignmentCache = new Map();

    /**
     * Initialize the SDK
     * @param {Object} options - Configuration options
     * @param {string} options.apiUrl - Base URL of the API
     * @param {string} [options.userId] - Optional user ID
     */
    function init(options) {
        if (!options || !options.apiUrl) {
            console.error('[ABTest] apiUrl is required');
            return;
        }

        config = {
            ...config,
            ...options,
        };

        console.log('[ABTest] Initialized with config:', config);
    }

    /**
     * Get variation assignment for an experiment
     * @param {string} experimentId - Experiment ID
     * @returns {Promise<Object>} Assignment data
     */
    async function getVariation(experimentId) {
        if (!config.apiUrl) {
            console.error('[ABTest] SDK not initialized. Call ABTest.init() first.');
            return { assigned: false };
        }

        // Check cache
        if (assignmentCache.has(experimentId)) {
            return assignmentCache.get(experimentId);
        }

        try {
            const userId = getUserId();
            const response = await fetch(`${config.apiUrl}/api/assign`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    experiment_id: experimentId,
                    user_id: userId,
                }),
            });

            if (!response.ok) {
                console.error('[ABTest] Failed to get variation:', response.statusText);
                return { assigned: false };
            }

            const data = await response.json();

            // Cache the assignment
            assignmentCache.set(experimentId, data);

            // Track page view automatically
            if (data.assigned) {
                trackEvent(experimentId, data.variation_id, 'page_view');
            }

            return data;
        } catch (error) {
            console.error('[ABTest] Error getting variation:', error);
            return { assigned: false };
        }
    }

    /**
     * Track an event
     * @param {string} experimentId - Experiment ID
     * @param {string} variationId - Variation ID
     * @param {string} eventType - Event type ('page_view' or 'conversion')
     * @param {string} [eventName] - Optional event name
     * @param {Object} [metadata] - Optional metadata
     */
    async function trackEvent(experimentId, variationId, eventType, eventName, metadata) {
        if (!config.apiUrl) {
            console.error('[ABTest] SDK not initialized. Call ABTest.init() first.');
            return;
        }

        try {
            const userId = getUserId();
            const response = await fetch(`${config.apiUrl}/api/track`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    experiment_id: experimentId,
                    variation_id: variationId,
                    user_id: userId,
                    event_type: eventType,
                    event_name: eventName,
                    metadata: metadata,
                }),
            });

            if (!response.ok) {
                console.error('[ABTest] Failed to track event:', response.statusText);
            }
        } catch (error) {
            console.error('[ABTest] Error tracking event:', error);
        }
    }

    /**
     * Track a conversion event
     * @param {string} experimentId - Experiment ID
     * @param {string} [eventName] - Optional event name
     * @param {Object} [metadata] - Optional metadata
     */
    async function trackConversion(experimentId, eventName, metadata) {
        // Get variation from cache
        const assignment = assignmentCache.get(experimentId);

        if (!assignment || !assignment.assigned) {
            console.warn('[ABTest] No assignment found for experiment:', experimentId);
            return;
        }

        await trackEvent(
            experimentId,
            assignment.variation_id,
            'conversion',
            eventName,
            metadata
        );
    }

    /**
     * Run an experiment with callback
     * @param {string} experimentId - Experiment ID
     * @param {Function} callback - Callback function receiving variation
     * @param {Object} options - Options for redirect behavior
     */
    async function run(experimentId, callback, options = {}) {
        const variation = await getVariation(experimentId);

        // Handle URL-based redirect if variation has a URL
        if (variation.assigned && variation.variation_url && options.autoRedirect !== false) {
            const currentUrl = window.location.href;
            const variationUrl = variation.variation_url;

            // Only redirect if we're not already on the variation URL
            if (!currentUrl.includes(variationUrl) && window.location.pathname !== new URL(variationUrl, window.location.origin).pathname) {
                window.location.href = variationUrl;
                return variation;
            }
        }

        if (typeof callback === 'function') {
            callback(variation);
        }

        return variation;
    }

    /**
     * Run URL-based redirect experiment (will automatically redirect)
     * @param {string} experimentId - Experiment ID
     */
    async function runUrlTest(experimentId) {
        return run(experimentId, null, { autoRedirect: true });
    }

    // Expose public API
    window.ABTest = {
        init: init,
        getVariation: getVariation,
        trackConversion: trackConversion,
        trackEvent: trackEvent,
        run: run,
        runUrlTest: runUrlTest,
        getUserId: getUserId,
    };

})(window);
