// Copies the pdf.js worker script from node_modules into public/ so the
// browser loads it from our own origin instead of a third-party CDN.
// Runs automatically after `npm install` (see package.json "postinstall"),
// so it always matches whatever pdfjs-dist version is actually installed.
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');

const source = join(projectRoot, 'node_modules', 'pdfjs-dist', 'build', 'pdf.worker.min.mjs');
const destDir = join(projectRoot, 'public');
const dest = join(destDir, 'pdf.worker.min.mjs');

if (!existsSync(source)) {
  console.warn('[copy-pdf-worker] pdfjs-dist worker not found at', source, '- skipping copy.');
  process.exit(0);
}

mkdirSync(destDir, { recursive: true });
copyFileSync(source, dest);
console.log('[copy-pdf-worker] Copied pdf.worker.min.mjs to public/');
