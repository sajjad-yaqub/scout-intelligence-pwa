import { mkdirSync, rmSync, writeFileSync } from 'node:fs';

// Emit Vercel's Build Output API directly; no second Scout runtime or secrets.
rmSync('.vercel/output', { recursive: true, force: true });
mkdirSync('.vercel/output/static', { recursive: true });
writeFileSync('.vercel/output/static/deployment-ready.txt', 'Scout deployment ready');
writeFileSync('.vercel/output/config.json', JSON.stringify({
  version: 3,
  routes: [{ src: '/(.*)', dest: 'https://scout-ear-sound-finder.lovable.app/$1' }],
}, null, 2));
