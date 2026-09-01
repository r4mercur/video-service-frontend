#!/usr/bin/env node
// Writes src/app/core/app-version.generated.ts, gitignored and regenerated on every
// `npm install`/`npm ci` (see the "postinstall" script in package.json). GITHUB_REF_TYPE/
// GITHUB_REF_NAME are set by GitHub Actions itself - no `git` shell-out needed. release.yml only
// triggers on `v*.*.*` tag pushes, so a tag ref is exactly the "this is a real release" signal;
// ci.yml (branch/PR pushes) and local installs fall back to 'dev'.
import {writeFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const version = process.env.GITHUB_REF_TYPE === 'tag' ? process.env.GITHUB_REF_NAME : 'dev';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const outPath = join(scriptDir, '..', 'src', 'app', 'core', 'app-version.generated.ts');

writeFileSync(outPath, `export const APP_VERSION = ${JSON.stringify(version)};\n`);
