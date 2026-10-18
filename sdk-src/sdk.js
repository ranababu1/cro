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
    // Integrations tag their calls (the WordPress plugin sets data-via="wp") so the server can apply their rules.
    var via = (script && script.getAttribute('data-via')) === 'wp' ? 'wp' : '';
    var config = { apiUrl: apiUrl, apiKey: apiKey, userId: null };
    function withVia(path) { return via ? path + (path.indexOf('?') === -1 ? '?' : '&') + 'via=' + via : path; }
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
        var url = config.apiUrl + withVia(path);
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

    // Events are queued and sent together: page views within BATCH_MS, conversions right away,
    // and anything left when the page is hidden goes out with navigator.sendBeacon.
    var BATCH_MS = 1000;
    var MAX_BATCH = 50;
    var queue = [];
    var flushTimer = null;

    function flush(useBeacon) {
        if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
        if (!queue.length) return Promise.resolve();
        var batch = queue.splice(0, MAX_BATCH);
        var body = { events: batch };
        var sent = false;
        if (useBeacon && navigator.sendBeacon) {
            try {
                var url = config.apiUrl + withVia('/api/track?key=' + encodeURIComponent(config.apiKey));
                sent = navigator.sendBeacon(url, new Blob([JSON.stringify(body)], { type: 'text/plain' }));
            } catch { sent = false; }
        }
        var p = sent ? Promise.resolve() : send('/api/track', body, true).catch(function () { return {}; });
        if (queue.length) return p.then(function () { return flush(useBeacon); });
        return p;
    }

    function track(experimentId, variationId, eventType, goalId, eventName) {
        var ev = { experiment_id: experimentId, variation_id: variationId, user_id: getUserId(), event_type: eventType };
        if (goalId) ev.goal_id = goalId;
        if (eventName) ev.event_name = eventName;
        queue.push(ev);
        if (eventType === 'conversion' || queue.length >= MAX_BATCH) return flush(false);
        if (!flushTimer) flushTimer = setTimeout(function () { flush(false); }, BATCH_MS);
        return Promise.resolve();
    }

    function onHide() { flush(true); }
    window.addEventListener('pagehide', onHide);
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') onHide(); });

    function bindGoals(data) {
        if (goalsBound || !data.goals || !data.goals.length || !data.variation_id) return;
        goalsBound = true;
        // Goals split by kind once. A goal is dropped from its list after it fires, so each
        // click only checks goals that can still convert, and listeners go away when none remain.
        var pending = { click: [], form: [] };
        for (var j = 0; j < data.goals.length; j++) {
            var gg = data.goals[j];
            var kk = gg.type || 'click';
            if (pending[kk] && gg.selector) pending[kk].push(gg);
        }
        function handle(kind, ev) {
            var node = ev.target;
            var list = pending[kind];
            if (!node || !node.closest || !list.length) return;
            for (var i = list.length - 1; i >= 0; i--) {
                var g = list[i];
                var el = null;
                try { el = node.closest(g.selector); } catch { list.splice(i, 1); continue; /* bad selector */ }
                if (!el) continue;
                list.splice(i, 1);
                track(data.experiment_id, data.variation_id, 'conversion', g.id, g.name);
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

    // Heatmap capture is a separate module, loaded only when the server says this session is sampled
    // on a paid plan. It records clicks and scroll depth, never keystrokes or field values.
    var heatLoaded = false;
    function loadHeatmaps(data) {
        if (heatLoaded) return;
        heatLoaded = true;
        window.__ABTestHeat = { apiUrl: config.apiUrl, apiKey: config.apiKey, via: via, experiment_id: data.experiment_id, variation_id: data.variation_id };
        var sc = document.createElement('script');
        sc.src = config.apiUrl + '/heatmap.js';
        sc.async = true;
        (document.head || document.documentElement).appendChild(sc);
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
                    if (data.capture && data.capture.heatmaps) loadHeatmaps(data);
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

    /**
     * Custom event goal: ABTest.track('signup'). Counts for every running test with a matching event goal.
     * Revenue goal: ABTest.track('purchase', { revenue: 49.99 }) also records the order value (paid plans).
     */
    function trackEvent(name, options) {
        if (!name || !config.apiUrl || !config.apiKey) return Promise.resolve();
        var body = { user_id: getUserId(), event_name: String(name) };
        var revenue = options && typeof options === 'object' ? Number(options.revenue) : NaN;
        if (isFinite(revenue) && revenue >= 0) body.revenue = revenue;
        return send('/api/sdk/event', body, true)
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
