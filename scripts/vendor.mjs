// Copies third-party libraries out of node_modules into vendor/, so the web app and
// the phone app load them locally (works offline, no CDN needed). Run: npm run vendor
import { cpSync, mkdirSync, rmSync } from 'node:fs';
const nm = (p) => new URL('../node_modules/' + p, import.meta.url);
const out = (p) => new URL('../vendor/' + p, import.meta.url);
rmSync(out(''), { recursive: true, force: true });
mkdirSync(out('tesseract/core'), { recursive: true });
mkdirSync(out('tesseract/lang'), { recursive: true });
const files = [
  ['@supabase/supabase-js/dist/umd/supabase.js', 'supabase.js'],
  ['@capacitor/core/dist/capacitor.js', 'capacitor.js'],
  ['qrcode-generator/qrcode.js', 'qrcode.js'],
  ['tesseract.js/dist/tesseract.min.js', 'tesseract/tesseract.min.js'],
  ['tesseract.js/dist/worker.min.js', 'tesseract/worker.min.js'],
  ['tesseract.js-core/tesseract-core-simd-lstm.wasm.js', 'tesseract/core/tesseract-core-simd-lstm.wasm.js'],
  ['tesseract.js-core/tesseract-core-lstm.wasm.js', 'tesseract/core/tesseract-core-lstm.wasm.js'],
  ['@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz', 'tesseract/lang/eng.traineddata.gz'],
];
for (const [from, to] of files) cpSync(nm(from), out(to));
console.log(`Copied ${files.length} files into vendor/`);
