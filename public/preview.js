/* freeabtest.com QA preview bar. Loaded only on pages opened with a preview link.
   Names the variation shown and leaves preview mode. Text is set as plain text, never as HTML. */
(function () {
    'use strict';
    var p = window.__ABTestPreview;
    if (!p || window.__ABTestPreviewOn) return;
    window.__ABTestPreviewOn = true;
    // A link that no longer works is forgotten, so the next page loads normally.
    if (p.error) { try { sessionStorage.removeItem('fabt_preview'); } catch (e) { /* storage blocked */ } }

    function show() {
        if (!document.body) { setTimeout(show, 50); return; }
        var bar = document.createElement('div');
        bar.setAttribute('data-fabt-preview', '1');
        bar.setAttribute('role', 'status');
        bar.style.cssText = 'position:fixed;left:12px;bottom:12px;z-index:2147483647;display:flex;gap:10px;align-items:center;max-width:calc(100% - 24px);box-sizing:border-box;padding:8px 12px;border-radius:8px;background:#18181b;color:#fff;font:13px/1.4 system-ui,sans-serif;box-shadow:0 4px 14px rgba(0,0,0,.3)';
        var text = document.createElement('span');
        text.textContent = p.error || ('Preview: ' + (p.variation_name || '') + (p.on_page ? '' : ' (this page is not part of the test)') + '. Not counted in results.');
        var exit = document.createElement('button');
        exit.type = 'button';
        exit.textContent = p.error ? 'Close' : 'Exit preview';
        exit.style.cssText = 'flex:none;padding:3px 8px;border:0;border-radius:6px;background:#fff;color:#18181b;font:inherit;cursor:pointer';
        exit.onclick = function () {
            if (p.error) { bar.parentNode.removeChild(bar); return; }
            try { sessionStorage.removeItem('fabt_preview'); } catch (e) { /* storage blocked */ }
            var u = new URL(window.location.href);
            u.searchParams.delete('fabt_preview');
            window.location.replace(u.toString());
        };
        bar.appendChild(text);
        bar.appendChild(exit);
        document.body.appendChild(bar);
    }
    show();
})();
