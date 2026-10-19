/* freeabtest.com visual changes and visual editor. Loaded only on pages that need it.
   Visitor mode: applies a variation's change list (text, hide, a few styles, safe attributes, moves and page CSS)
   before the page shows. Page CSS is set as text in one style element and may not load anything.
   Editor mode: opened from the dashboard with a short-lived link. Point and click to change the page, then save.
   Changes are plain data. This file never inserts HTML from a change list and never runs code from one. */
(function () {
    'use strict';
    var cfg = window.__ABTestVisual;
    if (!cfg || window.__ABTestVisualOn) return;
    window.__ABTestVisualOn = true;

    var SAFE_URL = /^(https?:\/\/|\/(?!\/)|#|mailto:|tel:)/i;
    var STYLE_VALUE = /^[#a-zA-Z0-9.,%()\s-]{1,100}$/;
    var STYLES = ['color', 'background-color', 'font-size', 'font-weight', 'text-align', 'border-radius', 'padding', 'margin'];
    var ATTRS = ['href', 'src', 'alt', 'placeholder', 'title'];
    var UNSAFE_CSS = /url\s*\(|@import|expression\s*\(|javascript:|behavior\s*:|-moz-binding|image-set\s*\(|[<\\]/i;
    var cssEl = null; // the page CSS style element, if any
    var cache = []; // visitor mode: elements each change was applied to, so later re-applies hit the same elements
    var movedDone = []; // visitor mode: moves run once per page
    var host = null; // editor UI root, never changed by a change list
    var touched = [];

    function inEditor(el) { return !!(host && (el === host || host.contains(el))); }

    function snapshot(el) {
        for (var i = 0; i < touched.length; i++) if (touched[i].el === el) return;
        var attrs = {};
        for (var j = 0; j < ATTRS.length; j++) attrs[ATTRS[j]] = el.getAttribute(ATTRS[j]);
        touched.push({ el: el, html: el.innerHTML, style: el.getAttribute('style'), srcset: el.getAttribute('srcset'), attrs: attrs, textChanged: false, parent: el.parentNode, next: el.nextSibling, moved: false });
    }

    function record(el) {
        for (var i = 0; i < touched.length; i++) if (touched[i].el === el) return touched[i];
        return null;
    }

    function connected(list) {
        for (var i = 0; i < list.length; i++) if (!list[i].isConnected) return false;
        return list.length > 0;
    }

    function applyCss(value) {
        if (typeof value !== 'string' || value.length > 10000 || UNSAFE_CSS.test(value)) return 0;
        if (!cssEl || !cssEl.isConnected) {
            cssEl = document.createElement('style');
            cssEl.setAttribute('data-fabt-css', '1');
            (document.head || document.documentElement).appendChild(cssEl);
        }
        if (cssEl.textContent !== value) cssEl.textContent = value;
        return 1;
    }

    function applyMove(c, el) {
        if (c.position !== 'before' && c.position !== 'after') return 0;
        var tgt;
        try { tgt = document.querySelector(c.target); } catch (e) { return 0; }
        if (!tgt || tgt === el || el.contains(tgt) || inEditor(tgt) || !tgt.parentNode) return 0;
        if (cfg.editor) { snapshot(el); record(el).moved = true; }
        if (c.position === 'before' ? tgt.previousElementSibling !== el : tgt.nextElementSibling !== el) {
            tgt.parentNode.insertBefore(el, c.position === 'before' ? tgt : tgt.nextSibling);
        }
        return 1;
    }

    function applyOne(c, idx) {
        if (c.action === 'css') return applyCss(c.value);
        if (c.action === 'move' && !cfg.editor && movedDone[idx]) return 1;
        var els;
        if (!cfg.editor && cache[idx] && connected(cache[idx])) els = cache[idx];
        else {
            try { els = document.querySelectorAll(c.selector); } catch (e) { return 0; }
            if (!cfg.editor && els.length) cache[idx] = Array.prototype.slice.call(els);
        }
        var n = 0;
        for (var i = 0; i < els.length; i++) {
            var el = els[i];
            if (inEditor(el)) continue;
            if (c.action === 'move') {
                // Only the first match moves, and only once per page for visitors.
                n = applyMove(c, el);
                if (n && !cfg.editor) movedDone[idx] = true;
                break;
            }
            n++;
            if (cfg.editor) snapshot(el);
            if (c.action === 'text') {
                if (el.textContent !== c.value) el.textContent = c.value;
                var r = record(el); if (r) r.textChanged = true;
            } else if (c.action === 'hide') {
                el.style.setProperty('display', 'none', 'important');
            } else if (c.action === 'style') {
                if (STYLES.indexOf(c.name) !== -1 && STYLE_VALUE.test(c.value)) el.style.setProperty(c.name, c.value, 'important');
            } else if (c.action === 'attr') {
                if (ATTRS.indexOf(c.name) === -1) continue;
                if ((c.name === 'href' || c.name === 'src') && !SAFE_URL.test(c.value)) continue;
                if (el.getAttribute(c.name) !== c.value) el.setAttribute(c.name, c.value);
                if (c.name === 'src' && el.hasAttribute('srcset')) el.removeAttribute('srcset');
            }
        }
        return n;
    }

    function applyAll(list) {
        var matched = 0;
        for (var i = 0; i < list.length; i++) if (applyOne(list[i], i)) matched++;
        return matched;
    }

    window.ABTestVisual = { apply: applyAll };

    // Visitor mode
    if (!cfg.editor) {
        var list = cfg.changes || [];
        var finished = false;
        var obs = window.MutationObserver ? new MutationObserver(function () { applyAll(list); }) : null;
        var stop = function () { setTimeout(function () { if (obs) obs.disconnect(); }, 2000); };
        var finish = function () {
            if (finished) return;
            finished = true;
            applyAll(list);
            if (typeof cfg.done === 'function') cfg.done();
        };
        applyAll(list);
        // Elements that appear while the page loads get their changes as soon as they are added.
        if (obs) obs.observe(document.documentElement, { childList: true, subtree: true });
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', finish); else finish();
        if (document.readyState === 'complete') stop(); else window.addEventListener('load', stop);
        return;
    }

    // Editor mode
    var token = cfg.editor;
    var changes = [];
    var info = null;
    var selected = null;
    var browsing = false;
    var dirty = false;
    var mini = false; // panel folded to its header, handy on small screens
    try { sessionStorage.setItem('fabt_editor', token); } catch (e) { /* storage blocked */ }
    // Keep the editor link out of the address bar, analytics and shared links.
    try {
        var here = new URL(window.location.href);
        if (here.searchParams.has('fabt_editor')) {
            here.searchParams.delete('fabt_editor');
            history.replaceState(history.state, '', here.toString());
        }
    } catch (e) { /* old browser */ }

    function api(method, body) {
        return fetch(cfg.apiUrl + '/api/sdk/visual', {
            method: method,
            headers: { 'Content-Type': 'application/json', 'X-Editor-Token': token },
            body: body ? JSON.stringify(body) : undefined,
        }).then(function (res) {
            return res.json().catch(function () { return {}; }).then(function (j) { return { ok: res.ok, body: j }; });
        });
    }

    function cssEscape(s) { return window.CSS && CSS.escape ? CSS.escape(s) : String(s).replace(/[^a-zA-Z0-9_-]/g, '\\$&'); }
    function unique(sel, el) {
        try { var m = document.querySelectorAll(sel); return m.length === 1 && m[0] === el; } catch (e) { return false; }
    }
    function stableId(id) { return id && !/\d{4,}/.test(id) && id.length < 60; }

    function selectorFor(el) {
        if (stableId(el.id) && unique('#' + cssEscape(el.id), el)) return '#' + cssEscape(el.id);
        var parts = [];
        var cur = el;
        while (cur && cur.nodeType === 1 && cur !== document.documentElement) {
            if (cur !== el && stableId(cur.id)) { parts.unshift('#' + cssEscape(cur.id)); break; }
            var part = cur.tagName.toLowerCase();
            var cls = [];
            for (var i = 0; i < (cur.classList || []).length && cls.length < 2; i++) {
                var c = cur.classList[i];
                if (/^[a-zA-Z_-][a-zA-Z0-9_-]*$/.test(c) && !/\d{3,}/.test(c) && c.indexOf('fabt-') !== 0) cls.push(cssEscape(c));
            }
            if (cls.length) part += '.' + cls.join('.');
            var parent = cur.parentElement;
            if (parent) {
                var same = [];
                for (var k = 0; k < parent.children.length; k++) if (parent.children[k].tagName === cur.tagName) same.push(parent.children[k]);
                if (same.length > 1) part += ':nth-of-type(' + (same.indexOf(cur) + 1) + ')';
            }
            parts.unshift(part);
            if (unique(parts.join(' > '), el)) return parts.join(' > ');
            cur = parent;
        }
        return parts.join(' > ');
    }

    function restoreAndApply() {
        if (cssEl) { if (cssEl.parentNode) cssEl.parentNode.removeChild(cssEl); cssEl = null; }
        for (var i = touched.length - 1; i >= 0; i--) {
            var t = touched[i];
            if (t.moved && t.parent) t.parent.insertBefore(t.el, t.next && t.next.parentNode === t.parent ? t.next : null);
            if (t.textChanged) t.el.innerHTML = t.html;
            if (t.style === null) t.el.removeAttribute('style'); else t.el.setAttribute('style', t.style);
            for (var a in t.attrs) { if (t.attrs[a] === null) t.el.removeAttribute(a); else t.el.setAttribute(a, t.attrs[a]); }
            if (t.srcset !== null) t.el.setAttribute('srcset', t.srcset);
        }
        touched = [];
        applyAll(changes);
    }

    // UI in a shadow root so site styles do not leak in and editor styles do not leak out.
    host = document.createElement('div');
    host.setAttribute('data-fabt-editor', '1');
    host.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2147483647;';
    var root = host.attachShadow ? host.attachShadow({ mode: 'open' }) : host;
    root.innerHTML = '<style>' +
        '*{box-sizing:border-box;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif}' +
        '.box{position:fixed;pointer-events:none;border:2px solid #2563eb;background:rgba(37,99,235,.08);border-radius:3px;display:none}' +
        '.sel{border-color:#0d9488;background:rgba(13,148,136,.10)}' +
        '.panel{position:fixed;right:12px;bottom:12px;width:min(340px,calc(100vw - 24px));max-height:78vh;overflow:auto;pointer-events:auto;background:#fff;color:#18181b;border:1px solid #e4e4e7;border-radius:12px;box-shadow:0 12px 40px rgba(0,0,0,.18);font-size:13px;line-height:1.45}' +
        '.hd{padding:12px 14px;border-bottom:1px solid #f4f4f5;display:flex;justify-content:space-between;gap:8px;align-items:flex-start}' +
        '.t{font-weight:600;font-size:14px}.m{color:#71717a;font-size:12px}.sec{padding:12px 14px;border-bottom:1px solid #f4f4f5}' +
        'label{display:block;font-size:12px;color:#52525b;margin:8px 0 3px}' +
        'input[type=text],textarea{width:100%;border:1px solid #d4d4d8;border-radius:6px;padding:6px 8px;font-size:13px;color:#18181b;background:#fff}' +
        'textarea{min-height:64px;resize:vertical}.row{display:flex;gap:6px;align-items:center}.row input[type=color]{width:34px;height:30px;border:1px solid #d4d4d8;border-radius:6px;padding:2px;background:#fff}' +
        'button{border:1px solid #d4d4d8;background:#fff;color:#18181b;border-radius:6px;padding:6px 10px;font-size:13px;cursor:pointer}' +
        'button.p{background:#2563eb;border-color:#2563eb;color:#fff}button:disabled{opacity:.5;cursor:default}' +
        '.code{font-family:ui-monospace,Menlo,monospace;font-size:11px;color:#3f3f46;word-break:break-all}' +
        'ul{list-style:none;margin:6px 0 0;padding:0}li{display:flex;gap:6px;justify-content:space-between;align-items:flex-start;padding:6px 0;border-top:1px solid #f4f4f5}' +
        'li button{padding:2px 7px;font-size:12px}.warn{background:#fffbeb;color:#92400e;border-radius:6px;padding:8px;margin-top:8px}.ok{color:#047857}.err{color:#b91c1c}' +
        '.chk{display:flex;gap:6px;align-items:center;margin-top:8px;color:#3f3f46;font-size:12px}' +
        '</style><div class="box hl"></div><div class="box sel"></div><div class="panel" role="dialog" aria-label="Visual editor"></div>';
    var hl = root.querySelector('.hl');
    var selBox = root.querySelector('.sel');
    var panel = root.querySelector('.panel');

    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (ch) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]; }); }
    function place(box, el) {
        if (!el) { box.style.display = 'none'; return; }
        var r = el.getBoundingClientRect();
        box.style.display = 'block';
        box.style.left = r.left - 2 + 'px'; box.style.top = r.top - 2 + 'px';
        box.style.width = r.width + 4 + 'px'; box.style.height = r.height + 4 + 'px';
    }
    function describe(c) {
        if (c.action === 'text') return 'Text: "' + (c.value.length > 40 ? c.value.slice(0, 37) + '...' : c.value) + '"';
        if (c.action === 'hide') return 'Hidden';
        if (c.action === 'move') return 'Moved ' + c.position + ' ' + c.target;
        if (c.action === 'css') return 'Page CSS (' + c.value.length + ' characters)';
        return c.name + ': ' + c.value;
    }
    function current(sel, action, name) {
        for (var i = 0; i < changes.length; i++) {
            var c = changes[i];
            if (c.selector === sel && c.action === action && (c.name || '') === (name || '')) return c;
        }
        return null;
    }
    function toHex(rgb) {
        var m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(rgb || '');
        if (!m) return '';
        return '#' + [m[1], m[2], m[3]].map(function (x) { return ('0' + Number(x).toString(16)).slice(-2); }).join('');
    }

    function render(status, kind) {
        var html = '<div class="hd"><div><div class="t">Visual editor</div><div class="m">' +
            (info ? esc(info.experiment_name) + ' &middot; ' + esc(info.variation_name) : 'Loading...') + '</div></div>' +
            '<div class="row"><button data-a="min" title="' + (mini ? 'Show the panel' : 'Fold the panel to see the page') + '">' + (mini ? 'Show' : 'Fold') + '</button><button data-a="exit" title="Close the editor">Exit</button></div></div>';
        if (mini) { panel.innerHTML = html + '<div class="sec row" style="justify-content:space-between"><span class="m">' + changes.length + ' changes' + (dirty ? ', not saved' : '') + '</span>' + (dirty ? '<button class="p" data-a="save">Save</button>' : '') + '</div>'; return; }
        if (info && info.control_url && !samePage(info.control_url)) {
            html += '<div class="sec"><div class="warn">This is not the test page. Visitors see these changes on <a href="' + esc(info.control_url) + '">' + esc(info.control_url) + '</a>.</div></div>';
        }
        if (info && info.status === 'running') html += '<div class="sec"><div class="warn">This test is running. Saved changes reach visitors in this variation on their next page load.</div></div>';
        html += '<div class="sec">';
        if (!selected) {
            var pageCss = current('page', 'css');
            html += '<div class="m">Click any element on the page to change it.</div>' +
                '<label class="chk"><input type="checkbox" data-a="browse"' + (browsing ? ' checked' : '') + '> Use the page normally (to open menus), then turn this off to pick</label>' +
                '<div class="m" style="margin-top:8px">Window width: ' + (window.innerWidth || 0) + 'px (' + deviceName() + ')</div>' +
                '<label>Page CSS</label><textarea data-f="css" spellcheck="false" placeholder=".hero h1 { letter-spacing: -0.02em; }">' + esc(pageCss ? pageCss.value : '') + '</textarea>' +
                '<div class="row" style="margin-top:6px"><button data-a="css">Apply CSS</button><span class="m">No url(), @import or backslashes.</span></div>';
        } else {
            var el = selected.el;
            var leaf = el.children.length === 0;
            var cs = window.getComputedStyle(el);
            var txt = current(selected.selector, 'text');
            var color = current(selected.selector, 'style', 'color');
            var bg = current(selected.selector, 'style', 'background-color');
            var fs = current(selected.selector, 'style', 'font-size');
            html += '<div class="m">Selected element</div><input type="text" data-f="selector" value="' + esc(selected.selector) + '" aria-label="CSS selector">';
            if (leaf) html += '<label>Text</label><textarea data-f="text">' + esc(txt ? txt.value : el.textContent) + '</textarea>';
            else html += '<div class="m" style="margin-top:8px">This element contains other elements. Click the exact text you want to change to edit its words.</div>';
            html += '<label>Text color</label><div class="row"><input type="color" data-f="color-pick" value="' + esc(color ? color.value : toHex(cs.color) || '#000000') + '"><input type="text" data-f="color" value="' + esc(color ? color.value : '') + '" placeholder="Unchanged"></div>' +
                '<label>Background</label><div class="row"><input type="color" data-f="bg-pick" value="' + esc(bg ? bg.value : toHex(cs.backgroundColor) || '#ffffff') + '"><input type="text" data-f="bg" value="' + esc(bg ? bg.value : '') + '" placeholder="Unchanged"></div>' +
                '<label>Font size</label><input type="text" data-f="fs" value="' + esc(fs ? fs.value : '') + '" placeholder="' + esc(cs.fontSize) + '">';
            if (el.tagName === 'A') { var href = current(selected.selector, 'attr', 'href'); html += '<label>Link address</label><input type="text" data-f="href" value="' + esc(href ? href.value : el.getAttribute('href') || '') + '">'; }
            if (el.tagName === 'IMG') {
                var src = current(selected.selector, 'attr', 'src');
                var alt = current(selected.selector, 'attr', 'alt');
                html += '<label>Image address</label><input type="text" data-f="src" value="' + esc(src ? src.value : el.getAttribute('src') || '') + '">' +
                    '<label>Image description (alt)</label><input type="text" data-f="alt" value="' + esc(alt ? alt.value : el.getAttribute('alt') || '') + '">';
            }
            html += '<label>Position</label><div class="row"><button data-a="up" title="Move before the previous element">Move up</button><button data-a="down" title="Move after the next element">Move down</button></div>';
            html += '<label class="chk"><input type="checkbox" data-f="hide"' + (current(selected.selector, 'hide') ? ' checked' : '') + '> Hide this element</label>' +
                '<div class="row" style="margin-top:10px"><button class="p" data-a="apply">Apply</button><button data-a="cancel">Cancel</button></div>';
        }
        html += '</div><div class="sec"><div class="t" style="font-size:13px">Changes (' + changes.length + ')</div>';
        if (!changes.length) html += '<div class="m">No changes yet.</div>';
        else {
            html += '<ul>';
            for (var i = 0; i < changes.length; i++) html += '<li><div><div>' + esc(describe(changes[i])) + '</div><div class="code">' + esc(changes[i].selector) + '</div></div><button data-a="remove" data-i="' + i + '" aria-label="Remove change">Remove</button></li>';
            html += '</ul>';
        }
        html += '</div><div class="sec row" style="justify-content:space-between"><span class="' + (kind || 'm') + '" data-s="1">' + esc(status || (dirty ? 'Unsaved changes' : 'All changes saved')) + '</span>' +
            '<button class="p" data-a="save"' + (dirty ? '' : ' disabled') + '>Save</button></div>';
        panel.innerHTML = html;
    }

    function samePage(u) {
        try {
            var a = new URL(u), b = new URL(window.location.href);
            return a.host.replace(/^www\./, '') === b.host.replace(/^www\./, '') && a.pathname.replace(/\/+$/, '') === b.pathname.replace(/\/+$/, '');
        } catch (e) { return true; }
    }

    function setChange(sel, action, name, value) {
        var next = [];
        for (var i = 0; i < changes.length; i++) {
            var c = changes[i];
            if (!(c.selector === sel && c.action === action && (c.name || '') === (name || ''))) next.push(c);
        }
        if (value !== null) {
            var ch = { selector: sel, action: action };
            if (name) ch.name = name;
            if (action !== 'hide') ch.value = value;
            next.push(ch);
        }
        changes = next;
    }

    function deviceName() {
        var w = window.innerWidth || 0;
        return w < 768 ? 'mobile' : w < 1024 ? 'tablet' : 'desktop';
    }

    function sibling(el, dir) {
        var s = dir < 0 ? el.previousElementSibling : el.nextElementSibling;
        while (s && (inEditor(s) || s.tagName === 'SCRIPT' || s.tagName === 'STYLE')) s = dir < 0 ? s.previousElementSibling : s.nextElementSibling;
        return s;
    }

    // Moves are replayed in list order, so selectors are taken from the page as it is just before this move runs.
    function moveSelected(dir) {
        var el = selected.el;
        var tgt = sibling(el, dir);
        if (!tgt) return render(dir < 0 ? 'This element is already first in its container' : 'This element is already last in its container', 'err');
        var old = selected.selector;
        changes = changes.filter(function (c) { return !(c.action === 'move' && c.selector === old); });
        restoreAndApply();
        if (el === tgt || el.contains(tgt) || !el.isConnected || !tgt.isConnected) return render('Could not move this element', 'err');
        var s1 = selectorFor(el), s2 = selectorFor(tgt);
        if (changes.length >= 50) return render('A variation can have up to 50 changes', 'err');
        changes.push({ selector: s1, action: 'move', target: s2, position: dir < 0 ? 'before' : 'after' });
        dirty = true;
        restoreAndApply();
        selected = { el: el, selector: selectorFor(el) };
        place(selBox, el);
        render();
    }

    function applyPageCss() {
        var v = field('css').value;
        if (v.length > 10000) return render('Page CSS can be up to 10,000 characters', 'err');
        if (UNSAFE_CSS.test(v)) return render('Page CSS cannot use url(), @import, expression(), backslash escapes or < characters', 'err');
        var others = changes.filter(function (c) { return c.action !== 'css'; });
        if (v.trim()) {
            if (others.length >= 50) return render('A variation can have up to 50 changes', 'err');
            others.push({ selector: 'page', action: 'css', value: v });
        }
        changes = others;
        dirty = true;
        restoreAndApply();
        render();
    }

    function field(name) { return panel.querySelector('[data-f="' + name + '"]'); }

    function applySelected() {
        var oldSel = selected.selector;
        var sel = (field('selector').value || '').trim();
        if (!sel) return render('Add a CSS selector', 'err');
        try { document.querySelector(sel); } catch (e) { return render('That CSS selector is not valid', 'err'); }
        if (sel !== oldSel) {
            for (var i = 0; i < changes.length; i++) if (changes[i].selector === oldSel) changes[i].selector = sel;
        }
        var el = selected.el;
        var t = field('text');
        if (t) setChange(sel, 'text', '', t.value !== el.textContent || current(sel, 'text') ? t.value : null);
        var color = field('color').value.trim(), bg = field('bg').value.trim(), fs = field('fs').value.trim();
        var bad = [color, bg, fs].filter(function (v) { return v && !STYLE_VALUE.test(v); });
        if (bad.length) return render('Use plain CSS values, for example #0f766e or 18px', 'err');
        setChange(sel, 'style', 'color', color || null);
        setChange(sel, 'style', 'background-color', bg || null);
        setChange(sel, 'style', 'font-size', fs || null);
        var attrFields = [['href', 'href'], ['src', 'src'], ['alt', 'alt']];
        for (var k = 0; k < attrFields.length; k++) {
            var f = field(attrFields[k][0]);
            if (!f) continue;
            var v = f.value.trim();
            var orig = el.getAttribute(attrFields[k][1]) || '';
            if ((attrFields[k][1] === 'href' || attrFields[k][1] === 'src') && v && !SAFE_URL.test(v)) return render('Links and images need an http(s), relative, #, mailto: or tel: address', 'err');
            setChange(sel, 'attr', attrFields[k][1], v !== orig || current(sel, 'attr', attrFields[k][1]) ? v : null);
        }
        setChange(sel, 'hide', '', field('hide').checked ? '' : null);
        if (changes.length > 50) { changes = changes.slice(0, 50); return render('A variation can have up to 50 changes', 'err'); }
        dirty = true;
        selected = null;
        place(selBox, null);
        restoreAndApply();
        render();
    }

    panel.addEventListener('input', function (e) {
        var f = e.target.getAttribute('data-f');
        if (f === 'color-pick') field('color').value = e.target.value;
        if (f === 'bg-pick') field('bg').value = e.target.value;
    });
    panel.addEventListener('change', function (e) {
        if (e.target.getAttribute('data-a') === 'browse') { browsing = e.target.checked; place(hl, null); }
    });
    panel.addEventListener('click', function (e) {
        var b = e.target.closest ? e.target.closest('[data-a]') : null;
        if (!b) return;
        var a = b.getAttribute('data-a');
        if (a === 'min') { mini = !mini; render(); }
        if (a === 'apply') applySelected();
        if (a === 'up' || a === 'down') moveSelected(a === 'up' ? -1 : 1);
        if (a === 'css') applyPageCss();
        if (a === 'cancel') { selected = null; place(selBox, null); render(); }
        if (a === 'remove') { changes.splice(Number(b.getAttribute('data-i')), 1); dirty = true; restoreAndApply(); render(); }
        if (a === 'save') save();
        if (a === 'exit') {
            if (dirty && !window.confirm('Leave without saving your changes?')) return;
            try { sessionStorage.removeItem('fabt_editor'); } catch (err) { /* ignore */ }
            window.location.reload();
        }
    });

    function save() {
        render('Saving...');
        api('PUT', { changes: changes }).then(function (r) {
            if (!r.ok) return render(r.body.error || 'Could not save', 'err');
            changes = r.body.changes || changes;
            dirty = false;
            render('Saved. Visitors in this variation see it on their next page load.', 'ok');
        }).catch(function () { render('Could not reach freeabtest.com. Check your connection and try again.', 'err'); });
    }

    function pickable(e) {
        if (browsing) return null;
        var el = e.target;
        if (!el || el.nodeType !== 1 || inEditor(el) || el === document.documentElement || el === document.body) return null;
        return el;
    }
    document.addEventListener('mousemove', function (e) { var el = pickable(e); place(hl, el); }, true);
    document.addEventListener('click', function (e) {
        var el = pickable(e);
        if (!el) return;
        e.preventDefault();
        e.stopPropagation();
        selected = { el: el, selector: selectorFor(el) };
        place(selBox, el);
        render();
    }, true);
    window.addEventListener('scroll', function () { place(selBox, selected && selected.el); place(hl, null); }, true);
    // Keep the window width line current when the window is resized (for example a mobile-size preview window).
    window.addEventListener('resize', function () {
        var f = root.activeElement && root.activeElement.getAttribute ? root.activeElement.getAttribute('data-f') : null;
        if (!selected && !f) render();
    });
    window.addEventListener('beforeunload', function (e) { if (dirty) { e.preventDefault(); e.returnValue = ''; } });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && selected) { selected = null; place(selBox, null); render(); } }, true);

    function start() {
        (document.body || document.documentElement).appendChild(host);
        render();
        api('GET').then(function (r) {
            if (!r.ok) {
                try { sessionStorage.removeItem('fabt_editor'); } catch (e) { /* ignore */ }
                return render(r.body.error || 'Could not open the editor', 'err');
            }
            info = r.body;
            changes = r.body.changes || [];
            applyAll(changes);
            render();
        }).catch(function () { render('Could not reach freeabtest.com', 'err'); });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
