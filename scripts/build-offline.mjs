import { readdir, readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import path from 'node:path'

const root = path.resolve('dist')
async function filesIn(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  return (await Promise.all(entries.map((entry) => entry.isDirectory() ? filesIn(path.join(directory, entry.name)) : path.join(directory, entry.name)))).flat()
}
const files = (await filesIn(root)).filter((file) => /\.(html|js|css|png|svg|webmanifest)$/.test(file) && !file.endsWith(`${path.sep}sw.js`)).sort()
const digest = createHash('sha256')
for (const file of files) digest.update(await readFile(file))
const version = digest.digest('hex').slice(0, 16)
const urls = files.map((file) => '/' + path.relative(root, file).replaceAll('\\', '/'))
await writeFile(path.join(root, 'sw.js'), `
const CACHE = 'nestquest-shell-${version}';
const URLS = ${JSON.stringify(urls)};
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(URLS)));
});
// No skipWaiting: an update never replaces code underneath an open editor.
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('nestquest-shell-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (event.request.mode === 'navigate') {
    event.respondWith(caches.open(CACHE).then(cache => cache.match('/index.html')).then(cached => cached || fetch(event.request)));
  } else if (URLS.includes(url.pathname)) {
    event.respondWith(caches.open(CACHE).then(cache => cache.match(url.pathname)).then(cached => cached || fetch(event.request)));
  }
});
`)
console.log(`Offline shell ${version}: ${urls.length} assets`)
