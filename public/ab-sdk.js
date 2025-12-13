/**
 * A/B Testing Platform - Client SDK
 * Lightweight JavaScript snippet for embedding on customer sites
 * 
 * Usage:
 * <script src="https://your-domain.com/ab-sdk.js"></script>
 * <script>
 *   ABTest.init({
 *     apiUrl: 'https://your-domain.com',
 *     userId: 'user-123' // Optional: pass user ID or it will be generated
 *   });
 *   
 *   // Get assignment for an experiment
 *   ABTest.getVariation('exp_abc123').then(variation => {
 *     if (variation.assigned) {
 *       // Apply variation logic
 *       console.log('User assigned to:', variation.variation_name);
 *     }
 *   });
 *   
 *   // Track a conversion event
 *   ABTest.track('exp_abc123', 'conversion', 'purchase');
 * </script>
 */

(function (window) {
    'use strict';

    // Configuration
    let config = {
        apiUrl: '',
        userId: null,
    };

    // Storage key for user ID
    const USER_ID_KEY = 'ab_test_user_id';
    const ASSIGNMENTS_KEY = 'ab_test_assignments';

    /**
     * Generate a random user ID
     */
    function generateUserId() {
        return 'user_' + Date.now() + '_' + Math.random().toString(36).substring(2, 11);
    }

    /**
     * Get or create user ID from localStorage
     */
    function getUserId() {
        if (config.userId) {
            return config.userId;
        }

        try {
            let userId = localStorage.getItem(USER_ID_KEY);
            if (!userId) {
                userId = generateUserId();
                localStorage.setItem(USER_ID_KEY, userId);
            }
            return userId;
        } catch (e) {
            // Fallback if localStorage is not available
            return generateUserId();
        }
    }

    /**
     * Get cached assignment from localStorage
     */
    function getCachedAssignment(experimentId) {
        try {
            const assignments = JSON.parse(localStorage.getItem(ASSIGNMENTS_KEY) || '{}');
            return assignments[experimentId] || null;
        } catch (e) {
            return null;
        }
    }

    /**
     * Cache assignment in localStorage
     */
    function cacheAssignment(experimentId, assignment) {
        try {
            const assignments = JSON.parse(localStorage.getItem(ASSIGNMENTS_KEY) || '{}');
            assignments[experimentId] = assignment;
            localStorage.setItem(ASSIGNMENTS_KEY, JSON.stringify(assignments));
        } catch (e) {
            // Ignore storage errors
        }
    }

    /**
     * Make API request
     */
    function apiRequest(endpoint, method, body) {
        return fetch(config.apiUrl + endpoint, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
            },
            body: body ? JSON.stringify(body) : undefined,
        }).then(function (response) {
            if (!response.ok) {
                throw new Error('API request failed');
            }
            return response.json();
        });
    }

    /**
     * Get variation assignment for an experiment
     */
    function getVariation(experimentId) {
        // Check cache first
        const cached = getCachedAssignment(experimentId);
        if (cached) {
            return Promise.resolve(cached);
        }

        // Request assignment from API
        const userId = getUserId();
        return apiRequest('/api/assign', 'POST', {
            experiment_id: experimentId,
            user_id: userId,
        }).then(function (assignment) {
            // Cache the assignment
            cacheAssignment(experimentId, assignment);

            // Automatically track page view if assigned
            if (assignment.assigned) {
                track(experimentId, 'page_view');
            }

            return assignment;
        });
    }

    /**
     * Track an event
     */
    function track(experimentId, eventType, eventName, metadata) {
        const userId = getUserId();

        // Get cached assignment
        const assignment = getCachedAssignment(experimentId);
        if (!assignment || !assignment.assigned) {
            console.warn('Cannot track event: user not assigned to experiment');
            return Promise.resolve();
        }

        return apiRequest('/api/track', 'POST', {
            experiment_id: experimentId,
            variation_id: assignment.variation_id,
            user_id: userId,
            event_type: eventType,
            event_name: eventName,
            metadata: metadata,
        }).catch(function (error) {
            console.error('Failed to track event:', error);
        });
    }

    /**
     * Initialize the SDK
     */
    function init(options) {
        if (!options || !options.apiUrl) {
            throw new Error('apiUrl is required');
        }

        config.apiUrl = options.apiUrl.replace(/\/$/, ''); // Remove trailing slash
        config.userId = options.userId || null;

        console.log('A/B Test SDK initialized');
    }

    // Public API
    window.ABTest = {
        init: init,
        getVariation: getVariation,
        track: track,
        getUserId: getUserId,
    };
})(window);
