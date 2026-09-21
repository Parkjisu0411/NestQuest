import http from 'node:http'
import { apiProxy } from './api-proxy.mjs'
import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../dist/', import.meta.url))
const port = Number(process.env.NESTQUEST_PORT || 4173)
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid NESTQUEST_PORT')
await stat(path.join(root, 'index.html')).catch(() => { throw new Error('먼저 npm run build를 실행해 주세요.') })
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' }
const server = http.createServer(async (request, response) => {
  if (request.url?.startsWith('/api/provider/')) { await apiProxy(request, response); return }
  if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405); response.end(); return }
  try {
    const url = new URL(request.url, 'http://localhost')
    const pathname = decodeURIComponent(url.pathname)
    const requested = path.resolve(root, '.' + pathname)
    if (requested !== path.resolve(root) && !requested.startsWith(path.resolve(root) + path.sep)) { response.writeHead(403); response.end(); return }
    let file = requested
    if (pathname === '/' || (!path.extname(pathname) && request.headers.accept?.includes('text/html'))) file = path.join(root, 'index.html')
    const bytes = await readFile(file)
    response.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control': pathname.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache', 'X-Content-Type-Options': 'nosniff' })
    response.end(request.method === 'HEAD' ? undefined : bytes)
  } catch { response.writeHead(404); response.end('Not found') }
})
server.on('error', (error) => { console.error(error.message); process.exitCode = 1 })
server.listen(port, '127.0.0.1', () => console.log(`NestQuest local: http://127.0.0.1:${port}`))
process.on('SIGINT', () => server.close())
