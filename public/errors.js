/* freeabtest.com JavaScript error tracking. Loaded only on paid plans, for visitors in a running test.
   Counts uncaught errors and unhandled promise rejections on this page for the test version the visitor sees.
   It sends the error message, file and line only: no stack traces, no page content, no field values. */
(function () {
    'use strict';
    var data = window.__ABTestMod;
    if (!data || !data.experiment_id || !data.variation_id || window.__ABTestErrOn) return;
    window.__ABTestErrOn = true;

    var me = document.currentScript && document.currentScript.src;
    var apiUrl = '';
    try { apiUrl = new URL(me).origin; } catch (e) { return; }
    var sdk = document.querySelector('script[data-key][src*="sdk.js"], script[data-api-key][src*="sdk.js"]');
    if (!sdk) return;
    var key = sdk.getAttribute('data-key') || sdk.getAttribute('data-api-key');
    var via = sdk.getAttribute('data-via') === 'wp' ? '&via=wp' : '';

    var MAX_PER_PAGE = 20;
    var seen = {};
    var pending = [];
    var reported = 0;
    var first = true;
    var timer = null;

    function own(src) { return !!src && src.indexOf(apiUrl + '/') === 0; }

    function add(kind, message, source, line) {
        if (own(source)) return;
        var k = kind + '|' + message + '|' + (source || '') + '|' + (line || 0);
        if (seen[k]) { seen[k].count++; return; }
        if (reported >= MAX_PER_PAGE) return;
        reported++;
        seen[k] = { kind: kind, message: String(message || 'Unknown error').slice(0, 500), source: source ? String(source).slice(0, 500) : undefined, line: line || 0, count: 1 };
        pending.push(seen[k]);
        if (!timer) timer = setTimeout(function () { send(false); }, 2000);
    }

    function send(beacon) {
        if (timer) { clearTimeout(timer); timer = null; }
        var list = [];
        for (var k in seen) if (seen[k].count > (seen[k].sent || 0)) list.push(seen[k]);
        if (!list.length) return;
        var errors = [];
        for (var i = 0; i < list.length; i++) {
            var e = list[i];
            errors.push({ kind: e.kind, message: e.message, source: e.source, line: e.line, count: e.count - (e.sent || 0) });
            e.sent = e.count;
        }
        var body = JSON.stringify({ experiment_id: data.experiment_id, variation_id: data.variation_id, first: first, errors: errors });
        first = false;
        pending = [];
        var url = apiUrl + '/api/sdk/errors?key=' + encodeURIComponent(key) + via;
        if (beacon && navigator.sendBeacon) {
            try { if (navigator.sendBeacon(url, new Blob([body], { type: 'text/plain' }))) return; } catch (err) { /* fall through */ }
        }
        try { fetch(url, { method: 'POST', body: body, keepalive: true, headers: { 'Content-Type': 'text/plain' } }); } catch (err) { /* ignore */ }
    }

    window.addEventListener('error', function (ev) {
        // Resource load errors (img, script tags) have no message; only count script errors.
        if (!ev || (ev.target && ev.target.tagName)) return;
        add('error', ev.message || (ev.error && ev.error.message) || 'Script error', ev.filename, ev.lineno);
    });
    window.addEventListener('unhandledrejection', function (ev) {
        var r = ev && ev.reason;
        var msg = r && r.message ? r.message : typeof r === 'string' ? r : 'Unhandled promise rejection';
        add('rejection', msg, r && r.fileName, r && r.lineNumber);
    });
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') send(true); });
    window.addEventListener('pagehide', function () { send(true); });

    window.ABTestErrors = { flush: function () { send(false); } };
})();
