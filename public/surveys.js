/* freeabtest.com surveys. Loaded only on paid plans, on pages where an active survey matches.
   One question per survey. Sends the answer and the page path only: no visitor id, no page content. */
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

    if (!ready() || !data.surveys || !data.surveys.length || window.__ABTestSrvOn) return;
    window.__ABTestSrvOn = true;

    var SRV_CSS = '.opts{display:flex;flex-direction:column;gap:8px;margin:4px 0 14px}.rate{flex-direction:row;gap:6px}' +
        '.opt{display:block;width:100%;text-align:left;padding:9px 12px;border:1px solid #cbd5e1;border-radius:9px;background:#fff;color:#0f172a;font-size:14px;cursor:pointer}' +
        '.rate .opt{text-align:center;padding:9px 0}.opt[aria-pressed=true]{color:#fff}' +
        'textarea{display:block;width:100%;min-height:72px;margin:0 0 14px;padding:8px 10px;border:1px solid #cbd5e1;border-radius:9px;font-size:14px;resize:vertical;color:#0f172a;background:#fff}' +
        'label{display:block;font-size:13px;color:#475569;margin:0 0 6px}.ends{display:flex;justify-content:space-between;font-size:12px;color:#64748b;margin:-8px 0 14px}' +
        'button.send{padding:9px 18px;border:0;border-radius:9px;color:#fff;font-size:14px;font-weight:600;cursor:pointer}button.send:disabled{opacity:.5;cursor:default}';

    function srvKey(q) { return 'fabt_srv_' + q.id; }
    function done(q) { return getFlag(store('once'), srvKey(q) + '_done'); }
    function send(q, ev, extra) {
        var body = { survey_id: q.id, event: ev };
        if (extra) { body.answer = extra.answer; if (extra.comment) body.comment = extra.comment; body.url = window.location.href; }
        beacon('/api/sdk/surveys', body);
    }

    function show(q) {
        if (done(q) || getFlag(store(q.frequency), srvKey(q)) || !claim()) return;
        setFlag(store(q.frequency), srvKey(q));
        var answered = false;
        var s = shell('data-abtest-survey', q.id, SRV_CSS, q.position, q.question, function () { if (!answered) send(q, 'close'); });
        s.box.appendChild(el('h2', '', q.question));
        var form = el('div');
        var choice = null;
        var submit = el('button', 'send', q.button_text);
        submit.type = 'button';
        submit.style.background = q.color;
        var text = null;
        if (q.type === 'text') {
            text = el('textarea');
            text.maxLength = 1000;
            text.setAttribute('aria-label', q.question);
            form.appendChild(text);
            submit.disabled = true;
            text.addEventListener('input', function () { submit.disabled = !text.value.trim(); });
        } else {
            var list = el('div', q.type === 'rating' ? 'opts rate' : 'opts');
            var values = q.type === 'rating' ? ['1', '2', '3', '4', '5'] : q.options;
            var buttons = [];
            for (var i = 0; i < values.length; i++) (function (v) {
                var b = el('button', 'opt', v);
                b.type = 'button';
                b.setAttribute('aria-pressed', 'false');
                b.addEventListener('click', function () {
                    choice = v;
                    for (var j = 0; j < buttons.length; j++) {
                        var on = buttons[j] === b;
                        buttons[j].setAttribute('aria-pressed', on ? 'true' : 'false');
                        buttons[j].style.background = on ? q.color : '#fff';
                        buttons[j].style.borderColor = on ? q.color : '#cbd5e1';
                    }
                    submit.disabled = false;
                });
                buttons.push(b);
                list.appendChild(b);
            })(values[i]);
            form.appendChild(list);
            if (q.type === 'rating') {
                var ends = el('div', 'ends');
                ends.appendChild(el('span', '', 'Not at all'));
                ends.appendChild(el('span', '', 'Very'));
                form.appendChild(ends);
            }
            if (q.comment) {
                form.appendChild(el('label', '', q.comment_label));
                text = el('textarea');
                text.maxLength = 1000;
                text.setAttribute('aria-label', q.comment_label);
                form.appendChild(text);
            }
            submit.disabled = true;
        }
        submit.addEventListener('click', function () {
            var answer = q.type === 'text' ? text.value.trim() : choice;
            if (!answer || answered) return;
            answered = true;
            setFlag(store('once'), srvKey(q) + '_done');
            send(q, 'response', { answer: q.type === 'rating' ? Number(answer) : answer, comment: q.type !== 'text' && text ? text.value.trim() : '' });
            form.parentNode.removeChild(form);
            s.box.appendChild(el('p', '', q.thanks));
            setTimeout(s.remove, 2500);
        });
        form.appendChild(submit);
        s.box.appendChild(form);
        s.open();
        send(q, 'view');
    }

    start(function () {
        for (var i = 0; i < data.surveys.length; i++) {
            var q = data.surveys[i];
            if (!done(q) && !getFlag(store(q.frequency), srvKey(q))) arm(q, show);
        }
    });
})();
