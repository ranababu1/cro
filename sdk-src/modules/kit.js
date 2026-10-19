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
