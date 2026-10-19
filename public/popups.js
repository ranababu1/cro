/* freeabtest.com popups and calls to action. Loaded only on paid plans, on pages where an active popup matches.
   Content is set as plain text, never as HTML. Counts views, button clicks and closes, nothing else. */
(function () {
    'use strict';
    var data = window.__ABTestMod;
    if (!data || !data.popups || !data.popups.length || window.__ABTestPopOn) return;
    window.__ABTestPopOn = true;

    var me = document.currentScript && document.currentScript.src;
    var apiUrl = '';
    try { apiUrl = new URL(me).origin; } catch (e) { return; }
    var sdk = document.querySelector('script[data-key][src*="sdk.js"], script[data-api-key][src*="sdk.js"]');
    if (!sdk) return;
    var key = sdk.getAttribute('data-key') || sdk.getAttribute('data-api-key');
    var via = sdk.getAttribute('data-via') === 'wp' ? '&via=wp' : '';
    var mobile = window.innerWidth < 768;
    var shown = false;

    function store(f) { try { return f === 'once' ? window.localStorage : f === 'session' ? window.sessionStorage : null; } catch (e) { return null; } }
    function seen(p) { var s = store(p.frequency); try { return !!(s && s.getItem('fabt_pop_' + p.id)); } catch (e) { return false; } }
    function remember(p) { var s = store(p.frequency); try { if (s) s.setItem('fabt_pop_' + p.id, '1'); } catch (e) { /* private mode */ } }

    function beacon(p, ev) {
        var url = apiUrl + '/api/sdk/popups?key=' + encodeURIComponent(key) + via;
        var body = JSON.stringify({ popup_id: p.id, event: ev });
        if (navigator.sendBeacon) {
            try { if (navigator.sendBeacon(url, new Blob([body], { type: 'text/plain' }))) return; } catch (e) { /* fall through */ }
        }
        try { fetch(url, { method: 'POST', body: body, keepalive: true, headers: { 'Content-Type': 'text/plain' } }); } catch (e) { /* ignore */ }
    }

    var CSS = ':host{all:initial}*{box-sizing:border-box;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif}' +
        '.ov{position:fixed;inset:0;background:rgba(15,23,42,.45);z-index:2147483646;display:flex;align-items:center;justify-content:center;padding:16px}' +
        '.box{position:relative;background:#fff;color:#0f172a;border-radius:14px;box-shadow:0 20px 50px rgba(15,23,42,.25);padding:24px 24px 20px;max-width:420px;width:100%;line-height:1.45}' +
        '.corner{position:fixed;bottom:20px;z-index:2147483646;max-width:340px;width:calc(100% - 40px)}.bottom-right{right:20px}.bottom-left{left:20px}' +
        '.bar{position:fixed;left:0;right:0;z-index:2147483646;display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:12px;padding:10px 44px 10px 16px;color:#fff;line-height:1.35}' +
        '.top-bar{top:0}.bottom-bar{bottom:0}' +
        'h2{margin:0 0 6px;font-size:18px;font-weight:700}.bar h2{font-size:15px;margin:0}p{margin:0 0 16px;font-size:14px;color:#334155;white-space:pre-line}.bar p{margin:0;color:inherit;opacity:.92}' +
        'a.btn{display:inline-block;padding:10px 18px;border-radius:9px;color:#fff;font-size:14px;font-weight:600;text-decoration:none}.bar a.btn{background:#fff!important;padding:6px 14px}' +
        'button.x{position:absolute;top:8px;right:8px;width:30px;height:30px;border:0;background:transparent;font-size:20px;line-height:1;cursor:pointer;color:inherit;opacity:.7;border-radius:6px}button.x:hover{opacity:1}' +
        '.bar button.x{top:50%;transform:translateY(-50%)}';

    function show(p) {
        if (shown || seen(p)) return;
        shown = true;
        remember(p);
        var host = document.createElement('div');
        host.setAttribute('data-abtest-popup', p.id);
        var root = host.attachShadow ? host.attachShadow({ mode: 'open' }) : host;
        var style = document.createElement('style');
        style.textContent = CSS;
        root.appendChild(style);

        var bar = p.position === 'top-bar' || p.position === 'bottom-bar';
        var box = document.createElement('div');
        box.setAttribute('role', 'dialog');
        box.setAttribute('aria-label', p.title);
        var wrap = box;
        if (p.position === 'center') {
            wrap = document.createElement('div');
            wrap.className = 'ov';
            box.className = 'box';
            box.setAttribute('aria-modal', 'true');
            wrap.appendChild(box);
        } else if (bar) {
            box.className = 'bar ' + p.position;
            box.style.background = p.color;
        } else {
            box.className = 'box corner ' + p.position;
        }

        var h = document.createElement('h2');
        h.textContent = p.title;
        box.appendChild(h);
        if (p.body) {
            var t = document.createElement('p');
            t.textContent = p.body;
            box.appendChild(t);
        }
        var a = document.createElement('a');
        a.className = 'btn';
        a.textContent = p.button_text;
        a.href = p.button_url;
        if (bar) a.style.color = p.color; else a.style.background = p.color;
        if (p.new_tab) { a.target = '_blank'; a.rel = 'noopener'; }
        a.addEventListener('click', function () { beacon(p, 'click'); remove(); });
        box.appendChild(a);
        var x = document.createElement('button');
        x.className = 'x';
        x.type = 'button';
        x.setAttribute('aria-label', 'Close');
        x.textContent = '\u00d7';
        box.appendChild(x);

        function remove() {
            document.removeEventListener('keydown', onKey);
            if (host.parentNode) host.parentNode.removeChild(host);
        }
        function close() { beacon(p, 'close'); remove(); }
        function onKey(e) { if (e.key === 'Escape') close(); }
        x.addEventListener('click', close);
        if (wrap !== box) wrap.addEventListener('click', function (e) { if (e.target === wrap) close(); });
        document.addEventListener('keydown', onKey);

        root.appendChild(wrap);
        document.body.appendChild(host);
        if (p.position === 'center') try { a.focus(); } catch (e) { /* ignore */ }
        beacon(p, 'view');
    }

    function arm(p) {
        if (p.device === 'mobile' && !mobile) return;
        if (p.device === 'desktop' && mobile) return;
        if (seen(p)) return;
        if (p.trigger === 'scroll') {
            var onScroll = function () {
                var d = document.documentElement;
                var max = Math.max(1, (d.scrollHeight || 0) - window.innerHeight);
                if (((window.scrollY || d.scrollTop || 0) / max) * 100 >= p.trigger_value) {
                    window.removeEventListener('scroll', onScroll);
                    show(p);
                }
            };
            window.addEventListener('scroll', onScroll, { passive: true });
            onScroll();
        } else if (p.trigger === 'exit') {
            // Exit intent needs a mouse: the pointer leaving through the top of the window. Not shown on touch screens.
            if (mobile) return;
            var onOut = function (e) {
                if (!e.relatedTarget && e.clientY <= 0) {
                    document.removeEventListener('mouseout', onOut);
                    show(p);
                }
            };
            document.addEventListener('mouseout', onOut);
        } else {
            setTimeout(function () { show(p); }, Math.max(0, p.trigger_value) * 1000);
        }
    }

    function start() { for (var i = 0; i < data.popups.length; i++) arm(data.popups[i]); }
    if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
})();
