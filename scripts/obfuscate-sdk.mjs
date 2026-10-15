/**
 * Builds public/sdk.js from the readable source in sdk-src/sdk.js.
 * Run via `npm run sdk:build` (also hooked from `npm run build` and pretest).
 *
 * Note: javascript-obfuscator's `selfDefending` option forces `compact: true`,
 * which collapses the file to a handful of lines and fights the multi-line /
 * "many printed pages" requirement. We keep compact:false for a long, readable
 * (as in: multi-line) artifact, and skip selfDefending for that reason.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';
import JavaScriptObfuscator from 'javascript-obfuscator';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srcPath = path.join(root, 'sdk-src', 'sdk.js');
const outPath = path.join(root, 'public', 'sdk.js');

const MIN_BYTES = 25_000;
const MIN_LINES = 300;

const source = fs.readFileSync(srcPath, 'utf8');

function obfuscate(deadCodeThreshold) {
    return JavaScriptObfuscator.obfuscate(source, {
        compact: false,
        simplify: false,
        identifierNamesGenerator: 'mangled',
        renameGlobals: true,
        reservedNames: [
            '^ABTest$',
            '^window$',
            '^document$',
            '^navigator$',
            '^localStorage$',
            '^fetch$',
            '^console$',
            '^URL$',
            '^Math$',
            '^Date$',
            '^JSON$',
            '^Promise$',
            '^setTimeout$',
            '^Blob$',
            '^encodeURIComponent$',
            '^clearTimeout$',
        ],
        stringArray: true,
        stringArrayEncoding: ['rc4', 'base64'],
        stringArrayThreshold: 0.9,
        stringArrayRotate: true,
        stringArrayShuffle: true,
        stringArrayWrappersCount: 3,
        stringArrayWrappersType: 'function',
        stringArrayWrappersChainedCalls: true,
        stringArrayIndexShift: true,
        splitStrings: true,
        splitStringsChunkLength: 3,
        controlFlowFlattening: true,
        controlFlowFlatteningThreshold: 1,
        deadCodeInjection: true,
        deadCodeInjectionThreshold: deadCodeThreshold,
        // selfDefending forces compact:true in this library; omitted so output stays multi-line.
        selfDefending: false,
        numbersToExpressions: true,
        transformObjectKeys: true,
        unicodeEscapeSequence: false,
        target: 'browser',
        seed: 42,
    }).getObfuscatedCode();
}

let threshold = 0.4;
let code = obfuscate(threshold);
let lines = code.split('\n').length;
let bytes = Buffer.byteLength(code, 'utf8');

while ((bytes < MIN_BYTES || lines < MIN_LINES) && threshold < 1) {
    threshold = Math.min(1, Math.round((threshold + 0.15) * 100) / 100);
    code = obfuscate(threshold);
    lines = code.split('\n').length;
    bytes = Buffer.byteLength(code, 'utf8');
    console.error(`try deadCode=${threshold} -> ${lines} lines, ${bytes} bytes`);
}

const banner = [
    '/*',
    ' * freeabtest.com browser SDK (built / obfuscated).',
    ' * Readable source: sdk-src/sdk.js - rebuild with `npm run sdk:build`.',
    ' */',
    '',
].join('\n');

const out = banner + code + (code.endsWith('\n') ? '' : '\n');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, out);

const outLines = out.split('\n').length;
const outBytes = Buffer.byteLength(out, 'utf8');
const gzip = zlib.gzipSync(Buffer.from(out), { level: 9 }).length;

const summary = {
    source: srcPath,
    out: outPath,
    deadCodeInjectionThreshold: threshold,
    lines: outLines,
    bytes: outBytes,
    gzip,
    selfDefending: false,
    selfDefendingNote: 'Disabled because javascript-obfuscator forces compact:true when selfDefending is on, which prevents the multi-line page-length target.',
};
console.log(JSON.stringify(summary, null, 2));
fs.writeFileSync(path.join(root, 'sdk-src', 'last-build.json'), JSON.stringify(summary, null, 2) + '\n');

if (outBytes < MIN_BYTES || outLines < MIN_LINES) {
    console.error(`SDK output below target (${MIN_BYTES} bytes / ${MIN_LINES} lines): got ${outBytes} / ${outLines}`);
    process.exit(1);
}
