/* freeabtest.com popups and calls to action. Loaded only on paid plans, on pages where an active popup matches.
   Content is set as plain text, never as HTML. Counts views, button clicks and closes, nothing else. */
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
