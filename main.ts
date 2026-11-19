// Neon Coast Cover Lab — the entry program (Node 22, standard library only).
// It hands the app in: it copies this directory's app/ (the offline cover
// maker) and screenshots/ to the output directory and writes
// /output/dossier.json with the vendored make.fun library, so the judge can
// read the app and its screenshots. The program runs twice and must write
// the same bytes both times, so it does nothing time- or order-dependent:
// the copies are plain recursive copies and the dossier is built from the
// files on disk.
//
// Try the app first with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

// The repository root is the directory this file lives in.
const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'app'), join(out, 'app'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// The gate's own caps (reference/gate.json): the text cap shapes the dossier's
// bytes; the rest refuse an entry the scorer would refuse — more than 4
// screenshots or one over 256 KiB, more than 993 files in app/ or 48 MiB of
// app files in all, or a path under app/ over 1000 bytes. app/ counts beside
// /output's own 1000-entry cap, its screenshots/ and dossier.json.
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    app_max_files: 993,
    app_max_bytes: 50331648,
    app_path_max_bytes: 1000,
  }),
);
