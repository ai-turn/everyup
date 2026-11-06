import { access, readFile, writeFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';

const site = resolve(process.argv[2] ?? '_site');
for (const path of ['index.html', 'en/index.html', 'guide/quickstart.html', 'en/guide/quickstart.html', 'demo/index.html']) {
  await access(resolve(site, path));
}
const demo = await readFile(resolve(site, 'demo/index.html'), 'utf8');
if (!demo.includes('<head>') || !demo.includes('/everyup/demo/assets/')) {
  throw new Error('The demo must be built with the GitHub Pages base path.');
}
// GitHub Pages serves this shell for SPA deep links and redirects missing docs.
await writeFile(resolve(site, '404.html'), demo.replace('<head>', '<head><script>if(!location.pathname.startsWith("/everyup/demo/"))location.replace("/everyup/")</script>'));
// Check the assembled site's assets rather than only the Vite build output.
for (const path of ['index.html', 'en/index.html', 'demo/index.html', '404.html']) {
  const html = await readFile(resolve(site, path), 'utf8');
  for (const match of html.matchAll(/(?:src|href)="(\/everyup\/[^"?#]+\.(?:js|css))(?:[?#][^"]*)?"/g)) {
    const asset = resolve(site, match[1].slice('/everyup/'.length));
    if (relative(site, asset).startsWith('..')) throw new Error('Asset escapes the site directory.');
    await access(asset);
  }
}
console.log('Validated docs, demo, 404 fallback, and local JS/CSS assets.');
