/* freeabtest.com popups and calls to action. Loaded only on paid plans, on pages where an active popup matches.
   Content is set as plain text, never as HTML. Counts views, button clicks and closes, nothing else. */
/* Built from sdk-src/modules by scripts/build-modules.mjs. Edit the sources, not this file. */
(function () {
    'use strict';
    /* Shared by popups.js and surveys.js: setup, display rules, beacons and the shadow-root shell.
       scripts/build-modules.mjs wraps this file and one module body in a single function, so nothing here is global. */
    var data = window.__ABTestMod;
    var me = document.currentScript && document.currentScript.src;
    var apiUrl = '';
    try { apiUrl = new URL(me).origin; } catch (e) { apiUrl = ''; }
    var sdk = document.querySelector('script[data-key][src*="sdk.js"], script[data-api-key][src*="sdk.js"]');
    var key = sdk ? sdk.getAttribute('data-key') || sdk.getAttribute('data-api-key') : '';
    var via = sdk && sdk.getAttribute('data-via') === 'wp' ? '&via=wp' : '';
    var mobile = window.innerWidth < 768;

    function ready() { return !!(data && apiUrl && key); }

    function store(f) { try { return f === 'once' ? window.localStorage : f === 'session' ? window.sessionStorage : null; } catch (e) { return null; } }
    function getFlag(s, k) { try { return !!(s && s.getItem(k)); } catch (e) { return false; } }
    function setFlag(s, k) { try { if (s) s.setItem(k, '1'); } catch (e) { /* private mode */ } }

    function beacon(path, body) {
        var url = apiUrl + path + '?key=' + encodeURIComponent(key) + via;
        var text = JSON.stringify(body);
        if (navigator.sendBeacon) {
            try { if (navigator.sendBeacon(url, new Blob([text], { type: 'text/plain' }))) return; } catch (e) { /* fall through */ }
        }
        try { fetch(url, { method: 'POST', body: text, keepalive: true, headers: { 'Content-Type': 'text/plain' } }); } catch (e) { /* ignore */ }
    }

    /** At most one popup or survey per page view, across both modules. */
    function claim() {
        if (window.__ABTestOverlay) return false;
        window.__ABTestOverlay = true;
        return true;
    }

    /** Device check, then the trigger: seconds, scroll depth or exit intent (mouse only). */
    function arm(item, show) {
        if (item.device === 'mobile' && !mobile) return;
        if (item.device === 'desktop' && mobile) return;
        if (item.trigger === 'scroll') {
            var onScroll = function () {
                var d = document.documentElement;
                var max = Math.max(1, (d.scrollHeight || 0) - window.innerHeight);
                if (((window.scrollY || d.scrollTop || 0) / max) * 100 >= item.trigger_value) {
                    window.removeEventListener('scroll', onScroll);
                    show(item);
                }
            };
            window.addEventListener('scroll', onScroll, { passive: true });
            onScroll();
        } else if (item.trigger === 'exit') {
            if (mobile) return;
            var onOut = function (e) {
                if (!e.relatedTarget && e.clientY <= 0) {
                    document.removeEventListener('mouseout', onOut);
                    show(item);
                }
            };
            document.addEventListener('mouseout', onOut);
        } else {
            setTimeout(function () { show(item); }, Math.max(0, item.trigger_value) * 1000);
        }
    }

    function el(tag, cls, text) {
        var n = document.createElement(tag);
        if (cls) n.className = cls;
        if (text !== undefined) n.textContent = text;
        return n;
    }

    var BASE_CSS = ':host{all:initial}*{box-sizing:border-box;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif}' +
        '.ov{position:fixed;inset:0;background:rgba(15,23,42,.45);z-index:2147483646;display:flex;align-items:center;justify-content:center;padding:16px}' +
        '.box{position:relative;background:#fff;color:#0f172a;border-radius:14px;box-shadow:0 20px 50px rgba(15,23,42,.25);padding:24px 24px 20px;max-width:420px;width:100%;line-height:1.45}' +
        '.corner{position:fixed;bottom:20px;z-index:2147483646;max-width:340px;width:calc(100% - 40px)}.bottom-right{right:20px}.bottom-left{left:20px}' +
        'h2{margin:0 0 6px;font-size:18px;font-weight:700}p{margin:0 0 16px;font-size:14px;color:#334155;white-space:pre-line}' +
        'button.x{position:absolute;top:8px;right:8px;width:30px;height:30px;border:0;background:transparent;font-size:20px;line-height:1;cursor:pointer;color:inherit;opacity:.7;border-radius:6px}button.x:hover{opacity:1}';

    /**
     * Builds the isolated layer: a host element with a shadow root, the box (centered with a dimmed background, or in a
     * corner) and a close button. onClose runs for the close button, Escape and a click outside a centered box.
     */
    function shell(attr, id, css, position, label, onClose) {
        var host = document.createElement('div');
        host.setAttribute(attr, id);
        var root = host.attachShadow ? host.attachShadow({ mode: 'open' }) : host;
        root.appendChild(el('style', '', BASE_CSS + css));
        var box = el('div', 'box');
        box.setAttribute('role', 'dialog');
        box.setAttribute('aria-label', label);
        var wrap = box;
        if (position === 'center') {
            wrap = el('div', 'ov');
            box.setAttribute('aria-modal', 'true');
            wrap.appendChild(box);
        } else if (position === 'bottom-right' || position === 'bottom-left') {
            box.className = 'box corner ' + position;
        }
        var x = el('button', 'x', '\u00d7');
        x.type = 'button';
        x.setAttribute('aria-label', 'Close');
        function remove() {
            document.removeEventListener('keydown', onKey);
            if (host.parentNode) host.parentNode.removeChild(host);
        }
        function onKey(e) { if (e.key === 'Escape') { remove(); onClose(); } }
        x.addEventListener('click', function () { remove(); onClose(); });
        if (wrap !== box) wrap.addEventListener('click', function (e) { if (e.target === wrap) { remove(); onClose(); } });
        document.addEventListener('keydown', onKey);
        return {
            host: host, root: root, box: box, wrap: wrap, remove: remove,
            open: function () { box.appendChild(x); root.appendChild(wrap); document.body.appendChild(host); }
        };
    }

    function start(fn) { if (document.body) fn(); else document.addEventListener('DOMContentLoaded', fn); }

    if (!ready() || !data.popups || !data.popups.length || window.__ABTestPopOn) return;
    window.__ABTestPopOn = true;

    var POP_CSS = '.bar{position:fixed;left:0;right:0;z-index:2147483646;display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:12px;padding:10px 44px 10px 16px;color:#fff;line-height:1.35}' +
        '.top-bar{top:0}.bottom-bar{bottom:0}.bar h2{font-size:15px;margin:0}.bar p{margin:0;color:inherit;opacity:.92}' +
        'a.btn{display:inline-block;padding:10px 18px;border-radius:9px;color:#fff;font-size:14px;font-weight:600;text-decoration:none}.bar a.btn{background:#fff!important;padding:6px 14px}' +
        '.bar button.x{top:50%;transform:translateY(-50%)}';

    function popKey(p) { return 'fabt_pop_' + p.id; }
    function send(p, ev) { beacon('/api/sdk/popups', { popup_id: p.id, event: ev }); }

    function show(p) {
        if (getFlag(store(p.frequency), popKey(p)) || !claim()) return;
        setFlag(store(p.frequency), popKey(p));
        var s = shell('data-abtest-popup', p.id, POP_CSS, p.position, p.title, function () { send(p, 'close'); });
        var bar = p.position === 'top-bar' || p.position === 'bottom-bar';
        if (bar) {
            s.box.className = 'bar ' + p.position;
            s.box.style.background = p.color;
        }
        s.box.appendChild(el('h2', '', p.title));
        if (p.body) s.box.appendChild(el('p', '', p.body));
        var a = el('a', 'btn', p.button_text);
        a.href = p.button_url;
        if (bar) a.style.color = p.color; else a.style.background = p.color;
        if (p.new_tab) { a.target = '_blank'; a.rel = 'noopener'; }
        a.addEventListener('click', function () { send(p, 'click'); s.remove(); });
        s.box.appendChild(a);
        s.open();
        if (p.position === 'center') try { a.focus(); } catch (e) { /* ignore */ }
        send(p, 'view');
    }

    start(function () {
        for (var i = 0; i < data.popups.length; i++) if (!getFlag(store(data.popups[i].frequency), popKey(data.popups[i]))) arm(data.popups[i], show);
    });
})();
