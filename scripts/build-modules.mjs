/**
 * Builds public/popups.js and public/surveys.js from sdk-src/modules. Each output is the shared kit plus one module
 * body inside its own function, so the two scripts share source code but stay separate files, each loaded only on
 * pages that need it. The install snippet (sdk.js) is not touched by this script.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, 'sdk-src', 'modules');
const kit = fs.readFileSync(path.join(dir, 'kit.js'), 'utf8');
const indent = (s) => s.trimEnd().split('\n').map((l) => (l ? '    ' + l : l)).join('\n');

export function buildModule(name) {
    const body = fs.readFileSync(path.join(dir, `${name}.js`), 'utf8');
    const header = body.slice(0, body.indexOf('*/') + 2);
    const rest = body.slice(body.indexOf('*/') + 2).replace(/^\n+/, '');
    return `${header}\n/* Built from sdk-src/modules by scripts/build-modules.mjs. Edit the sources, not this file. */\n(function () {\n    'use strict';\n${indent(kit)}\n\n${indent(rest)}\n})();\n`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    for (const name of ['popups', 'surveys']) {
        const out = buildModule(name);
        fs.writeFileSync(path.join(root, 'public', `${name}.js`), out);
        console.log(`public/${name}.js ${out.length} bytes`);
    }
}
