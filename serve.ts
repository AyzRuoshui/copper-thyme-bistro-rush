import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const GAME_ROOT = resolve(fileURLToPath(new URL('./game', import.meta.url)));

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.woff2': 'font/woff2',
  '.wasm': 'application/wasm',
};

function parsePort(argv: readonly string[]): number {
  const idx = argv.indexOf('--port');
  if (idx === -1) return 8080;
  const parsed = Number(argv[idx + 1]);
  return Number.isInteger(parsed) && parsed > 0 && parsed < 65536 ? parsed : 8080;
}

const port = parsePort(process.argv.slice(2));

const server = createServer((req, res) => {
  const parsedUrl = new URL(req.url ?? '/', 'http://127.0.0.1');
  let reqPath: string;
  try {
    reqPath = decodeURIComponent(parsedUrl.pathname);
  } catch {
    res.writeHead(400).end('Bad request');
    return;
  }

  if (reqPath.endsWith('/')) {
    reqPath += 'index.html';
  }

  const target = resolve(join(GAME_ROOT, normalize(reqPath)));
  if (target !== GAME_ROOT && !target.startsWith(GAME_ROOT + sep)) {
    res.writeHead(403).end('Forbidden');
    return;
  }

  let fileSize = 0;
  try {
    const info = statSync(target);
    if (!info.isFile()) {
      res.writeHead(404).end('Not found');
      return;
    }
    fileSize = info.size;
  } catch {
    res.writeHead(404).end('Not found');
    return;
  }

  const contentType = MIME_TYPES[extname(target).toLowerCase()] ?? 'application/octet-stream';
  res.writeHead(200, {
    'content-type': contentType,
    'content-length': fileSize,
    'cache-control': 'no-store',
  });
  createReadStream(target).pipe(res);
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Copper & Thyme Bistro serving game/ at http://127.0.0.1:${port}`);
});
