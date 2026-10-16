/* freeabtest.com heatmap capture. Loaded only for sampled sessions on paid plans.
   Records click position, a normalized element selector, rage and dead clicks, and max scroll depth.
   It never listens to keyboard events and never reads field values or page text. */
(function () {
    'use strict';
    var cfg = window.__ABTestHeat;
    if (!cfg || window.__ABTestHeatOn) return;
    window.__ABTestHeatOn = true;

    var w = window.innerWidth || document.documentElement.clientWidth || 1024;
    var device = w < 768 ? 'mobile' : w < 1024 ? 'tablet' : 'desktop';
    var queue = [];
    var maxDepth = 0;
    var recent = [];
    var INTERACTIVE = 'a,button,input,select,textarea,label,summary,[role=button],[role=link],[onclick],[tabindex]';
    var SAFE = /^[a-zA-Z0-9_-]+$/;

    function part(el) {
        var tag = el.tagName.toLowerCase();
        if (el.id && SAFE.test(el.id) && !/\d{3,}/.test(el.id)) return tag + '#' + el.id;
        var cls = [];
        var list = el.classList || [];
        for (var i = 0; i < list.length && cls.length < 2; i++) {
            if (SAFE.test(list[i]) && !/\d{3,}/.test(list[i])) cls.push(list[i]);
        }
        return tag + (cls.length ? '.' + cls.join('.') : '');
    }
    function selector(el) {
        var parts = [];
        while (el && el.nodeType === 1 && parts.length < 4 && el !== document.body) {
            var p = part(el);
            parts.unshift(p);
            if (p.indexOf('#') > 0) break;
            el = el.parentElement;
        }
        return (parts.join(' > ') || 'body').slice(0, 200);
    }
    function docHeight() {
        var d = document.documentElement, b = document.body;
        return Math.max(d.scrollHeight, b ? b.scrollHeight : 0, d.clientHeight);
    }

    function send(beacon) {
        var events = queue.splice(0, 200);
        if (beacon && maxDepth > 0) { events.push({ t: 's', d: Math.min(100, Math.round(maxDepth)) }); maxDepth = -1; }
        if (!events.length) return;
        var body = JSON.stringify({ experiment_id: cfg.experiment_id, variation_id: cfg.variation_id, device: device, events: events });
        var url = cfg.apiUrl + '/api/capture?key=' + encodeURIComponent(cfg.apiKey);
        if (beacon && navigator.sendBeacon) {
            try { if (navigator.sendBeacon(url, new Blob([body], { type: 'text/plain' }))) return; } catch (e) { /* fall through */ }
        }
        try { fetch(url, { method: 'POST', body: body, keepalive: true, headers: { 'Content-Type': 'text/plain' } }); } catch (e) { /* ignore */ }
    }

    document.addEventListener('click', function (ev) {
        var el = ev.target && ev.target.nodeType === 1 ? ev.target : ev.target && ev.target.parentElement;
        if (!el) return;
        var x = Math.round(((ev.pageX || 0) / Math.max(1, document.documentElement.scrollWidth)) * 1000);
        var y = Math.round(ev.pageY || 0);
        var now = Date.now();
        recent = recent.filter(function (r) { return now - r.t < 700 && Math.abs(r.x - ev.clientX) < 30 && Math.abs(r.y - ev.clientY) < 30; });
        recent.push({ t: now, x: ev.clientX, y: ev.clientY });
        var rage = recent.length >= 3;
        var dead = !(el.closest && el.closest(INTERACTIVE));
        queue.push({ t: 'c', x: Math.max(0, Math.min(1000, x)), y: Math.max(0, y), sel: selector(el), rage: rage || undefined, dead: dead || undefined });
        if (queue.length >= 50) send(false);
    }, true);

    function onScroll() {
        if (maxDepth < 0) return;
        var seen = ((window.scrollY || 0) + (window.innerHeight || 0)) / Math.max(1, docHeight()) * 100;
        if (seen > maxDepth) maxDepth = seen;
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    setInterval(function () { send(false); }, 10000);
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') send(true); });
    window.addEventListener('pagehide', function () { send(true); });
})();
