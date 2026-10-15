/**
 * freeabtest.com browser SDK
 *
 * Install once in <head> on the control and every variation page:
 *   <script src="https://YOUR-HOST/sdk.js" data-key="cro_pk_..." async></script>
 *
 * The SDK matches the current URL to a running test, sticky-buckets visitors,
 * redirects variation traffic without flicker, records exposures, and tracks
 * click goals by CSS selector. Bots are ignored.
 */
(function (window, document) {
    'use strict';

    var BOT = /bot|crawl|spider|slurp|facebookexternalhit|preview|headless/i;
    if (BOT.test(navigator.userAgent || '')) return;

    var script = document.currentScript || (function () {
        var list = document.getElementsByTagName('script');
        for (var i = list.length - 1; i >= 0; i--) {
            if ((list[i].src || '').indexOf('sdk.js') !== -1) return list[i];
        }
        return null;
    })();

    var apiKey = (script && (script.getAttribute('data-key') || script.getAttribute('data-api-key'))) || '';
    var apiUrl = '';
    if (script && script.src) {
        try { apiUrl = new URL(script.src).origin; } catch { apiUrl = ''; }
    }
    // Allow ABTest.init override for demos and tests.
    var config = { apiUrl: apiUrl, apiKey: apiKey, userId: null };
    var FLICKER_MS = 800;
    var assignmentCache = {};
    var goalsBound = false;
    var styleEl = null;

    function hide() {
        if (styleEl) return;
        styleEl = document.createElement('style');
        styleEl.setAttribute('data-abtest-flicker', '1');
        styleEl.textContent = 'html.abtest-wait,html.abtest-wait body{visibility:hidden!important}';
        (document.documentElement || document.head).appendChild(styleEl);
        document.documentElement.classList.add('abtest-wait');
        setTimeout(reveal, FLICKER_MS);
    }

    function reveal() {
        document.documentElement.classList.remove('abtest-wait');
        if (styleEl && styleEl.parentNode) styleEl.parentNode.removeChild(styleEl);
        styleEl = null;
    }

    function getUserId() {
        if (config.userId) return config.userId;
        try {
            var id = localStorage.getItem('ab_user_id');
            if (!id) {
                id = 'user_' + Date.now() + '_' + Math.random().toString(36).slice(2, 11);
                localStorage.setItem('ab_user_id', id);
            }
            return id;
        } catch {
            return 'user_' + Date.now() + '_' + Math.random().toString(36).slice(2, 11);
        }
    }

    // New vs returning: a visitor is returning when their first visit was in an earlier browser session.
    function visitorType() {
        try {
            var cached = sessionStorage.getItem('ab_visitor');
            if (cached === 'new' || cached === 'returning') return cached;
            var type = localStorage.getItem('ab_first_seen') ? 'returning' : 'new';
            if (type === 'new') localStorage.setItem('ab_first_seen', String(Date.now()));
            sessionStorage.setItem('ab_visitor', type);
            return type;
        } catch {
            return 'new';
        }
    }

    function send(path, body, keepalive) {
        var url = config.apiUrl + path;
        var payload = JSON.stringify(body);
        var headers = { 'Content-Type': 'application/json', 'X-API-Key': config.apiKey };
        
        return fetch(url, {
            method: 'POST',
            headers: headers,
            body: payload,
            keepalive: !!keepalive,
            credentials: 'omit',
            mode: 'cors',
        }).then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, status: r.status, body: j }; }); });
    }

    function track(experimentId, variationId, eventType, goalId, eventName) {
        return send('/api/track', {
            experiment_id: experimentId,
            variation_id: variationId,
            user_id: getUserId(),
            event_type: eventType,
            goal_id: goalId,
            event_name: eventName,
        }, eventType === 'conversion');
    }

    function bindGoals(data) {
        if (goalsBound || !data.goals || !data.goals.length || !data.variation_id) return;
        goalsBound = true;
        var fired = {};
        function handle(kind, ev) {
            var node = ev.target;
            if (!node) return;
            for (var i = 0; i < data.goals.length; i++) {
                var g = data.goals[i];
                if ((g.type || 'click') !== kind) continue;
                try {
                    var el = node.closest ? node.closest(g.selector) : null;
                    if (!el) continue;
                    var key = data.experiment_id + ':' + g.id;
                    if (fired[key]) continue;
                    fired[key] = true;
                    track(data.experiment_id, data.variation_id, 'conversion', g.id, g.name);
                } catch { /* bad selector */ }
            }
        }
        document.addEventListener('click', function (ev) { handle('click', ev); }, true);
        document.addEventListener('submit', function (ev) { handle('form', ev); }, true);
    }

    function redirectTo(variationUrl) {
        try {
            var target = new URL(variationUrl, window.location.href);
            // Keep query and hash from the current page.
            var cur = new URL(window.location.href);
            cur.searchParams.forEach(function (v, k) {
                if (!target.searchParams.has(k)) target.searchParams.set(k, v);
            });
            if (cur.hash && !target.hash) target.hash = cur.hash;
            // Loop guard: do not redirect if already on the variation path.
            if (window.location.pathname === target.pathname && window.location.origin === target.origin) {
                reveal();
                return;
            }
            window.location.replace(target.toString());
        } catch {
            reveal();
        }
    }

    function bootstrap() {
        if (!config.apiUrl || !config.apiKey) {
            console.error('[ABTest] Missing apiUrl or data-key');
            reveal();
            return Promise.resolve({ matched: false, action: 'none' });
        }
        hide();
        return send('/api/sdk/bootstrap', { url: window.location.href, user_id: getUserId(), referrer: document.referrer || '', visitor: visitorType() })
            .then(function (res) {
                var data = res.body || { matched: false, action: 'none' };
                if (!res.ok) {
                    reveal();
                    return data;
                }
                if (data.action === 'redirect' && data.variation_url) {
                    redirectTo(data.variation_url);
                    return data;
                }
                reveal();
                if (data.matched && data.variation_id && data.action !== 'guard') {
                    assignmentCache[data.experiment_id] = data;
                    track(data.experiment_id, data.variation_id, 'page_view');
                    bindGoals(data);
                }
                return data;
            })
            .catch(function (err) {
                console.error('[ABTest]', err);
                reveal();
                return { matched: false, action: 'none' };
            });
    }

    function init(options) {
        if (!options) return;
        if (options.apiUrl) config.apiUrl = options.apiUrl.replace(/\/$/, '');
        if (options.apiKey) config.apiKey = options.apiKey;
        if (options.userId) config.userId = options.userId;
    }

    /** Custom event goal: ABTest.track('signup'). Counts for every running test with a matching event goal. */
    function trackEvent(name) {
        if (!name || !config.apiUrl || !config.apiKey) return Promise.resolve();
        return send('/api/sdk/event', { user_id: getUserId(), event_name: String(name) }, true)
            .catch(function () { return {}; });
    }

    window.ABTest = {
        track: trackEvent,
        init: init,
        bootstrap: bootstrap,
        getUserId: getUserId,
        trackConversion: function (experimentId, eventName) {
            var a = assignmentCache[experimentId];
            if (!a || !a.variation_id) return Promise.resolve();
            return track(experimentId, a.variation_id, 'conversion', undefined, eventName);
        },
    };

    // Auto-start when a data-key is present on the script tag.
    if (config.apiKey && config.apiUrl) {
        if (document.readyState === 'loading') {
            // Hide ASAP, bootstrap ASAP
            hide();
            bootstrap();
        } else {
            hide();
            bootstrap();
        }
    }
})(window, document);
