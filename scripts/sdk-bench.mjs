import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import zlib from 'node:zlib';
import { Window } from 'happy-dom';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function loadSdk(code, { redirect = false } = {}) {
  const window = new Window({ url: 'https://example.com/page' });
  const document = window.document;
  document.write(`<!doctype html><html><head>
    <script src="https://example.com/sdk.js" data-key="cro_pk_dev_testkey1234567890abcdefghij"></script>
  </head><body><button id="headerCTA">Go</button></body></html>`);
  const script = document.querySelector('script');
  Object.defineProperty(document, 'currentScript', { get: () => script, configurable: true });

  window.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      matched: true,
      action: redirect ? 'redirect' : 'expose',
      experiment_id: 'exp_1',
      variation_id: 'var_1',
      variation_url: redirect ? 'https://example.com/v1' : undefined,
      goals: [{ id: 'gol_1', name: 'CTA', selector: '#headerCTA', is_primary: true }],
    }),
  });

  let replaced = null;
  window.location.replace = (u) => { replaced = String(u); };

  // happy-dom Window is not a full vm context; eval in window via indirect
  const t0 = performance.now();
  window.eval(code);
  const tLoad = performance.now() - t0;

  if (!window.ABTest) return { error: 'no ABTest', tLoadMs: tLoad };
  const start = performance.now();
  // Prevent auto double-bootstrap races: call bootstrap explicitly after init override
  window.ABTest.init({ apiUrl: 'https://example.com', apiKey: 'cro_pk_dev_testkey1234567890abcdefghij', userId: 'bench_user' });
  const data = await window.ABTest.bootstrap();
  const tBoot = performance.now() - start;
  const hidden = document.documentElement.classList.contains('abtest-wait');
  await window.happyDOM.close();
  return {
    tLoadMs: tLoad,
    tBootMs: tBoot,
    hasABTest: true,
    action: data?.action,
    replaced,
    revealed: !hidden || !!replaced,
  };
}

function sizes(label, text) {
  const buf = Buffer.from(text);
  return { label, lines: text.split('\n').length, bytes: buf.length, gzip: zlib.gzipSync(buf, { level: 9 }).length };
}

const src = fs.readFileSync(path.join(root, 'sdk-src/sdk.js'), 'utf8');
const built = fs.readFileSync(path.join(root, 'public/sdk.js'), 'utf8');
const results = { source: sizes('source', src), built: sizes('built', built), runs: [] };

for (const [label, code] of [['source', src], ['built', built]]) {
  const samples = [];
  for (let i = 0; i < 5; i++) samples.push(await loadSdk(code, { redirect: false }));
  const avg = (k) => samples.reduce((s, x) => s + (x[k] || 0), 0) / samples.length;
  results.runs.push({ label, avgLoadMs: +avg('tLoadMs').toFixed(3), avgBootMs: +avg('tBootMs').toFixed(3), sample: samples[0] });
}
results.redirect = await loadSdk(built, { redirect: true });
console.log(JSON.stringify(results, null, 2));
fs.writeFileSync(path.join(root, 'sdk-src/bench.json'), JSON.stringify(results, null, 2) + '\n');
