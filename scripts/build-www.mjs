// Gathers the web app's files into www/ for Capacitor (the phone app).
// The web version on GitHub Pages is served straight from the repo root, so the
// same files power both. Run: npm run build
import { cpSync, mkdirSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
const root = new URL('../', import.meta.url);
const www = new URL('../www/', import.meta.url);
rmSync(www, { recursive: true, force: true });
mkdirSync(www, { recursive: true });
for (const f of ['index.html', 'app.css', 'app.js', 'scan.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png', 'terms.html', 'privacy.html']) {
  cpSync(new URL(f, root), new URL(f, www));
}
cpSync(new URL('vendor/', root), new URL('vendor/', www), { recursive: true });
console.log('Built www/');
