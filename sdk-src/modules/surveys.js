/* freeabtest.com surveys. Loaded only on paid plans, on pages where an active survey matches.
   One question per survey. Sends the answer and the page path only: no visitor id, no page content. */
if (!ready() || !data.surveys || !data.surveys.length || window.__ABTestSrvOn) return;
window.__ABTestSrvOn = true;

var SRV_CSS = '.opts{display:flex;flex-direction:column;gap:8px;margin:4px 0 14px}.rate{flex-direction:row;gap:6px}' +
    '.opt{display:block;width:100%;text-align:left;padding:9px 12px;border:1px solid #cbd5e1;border-radius:9px;background:#fff;color:#0f172a;font-size:14px;cursor:pointer}' +
    '.rate .opt{text-align:center;padding:9px 0}.nps{gap:3px}.nps .opt{padding:8px 0;font-size:13px;border-radius:7px}.opt[aria-pressed=true]{color:#fff}' +
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
    var scale = q.type === 'rating' || q.type === 'nps';
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
        var list = el('div', q.type === 'nps' ? 'opts rate nps' : scale ? 'opts rate' : 'opts');
        var values = q.type === 'rating' ? ['1', '2', '3', '4', '5'] : q.type === 'nps' ? ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'] : q.options;
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
        if (scale) {
            var ends = el('div', 'ends');
            ends.appendChild(el('span', '', q.type === 'nps' ? 'Not likely' : 'Not at all'));
            ends.appendChild(el('span', '', q.type === 'nps' ? 'Very likely' : 'Very'));
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
        send(q, 'response', { answer: scale ? Number(answer) : answer, comment: q.type !== 'text' && text ? text.value.trim() : '' });
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
