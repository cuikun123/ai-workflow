import { randomUUID } from 'node:crypto';
import { open, readFile, rename, rm } from 'node:fs/promises';
import { createServer as createHttpServer } from 'node:http';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const defaultBookmarksFile = fileURLToPath(new URL('./bookmarks.json', import.meta.url));
const indexFile = new URL('./public/index.html', import.meta.url);

class ApiError extends Error {
  constructor(status,code,message){super(message);this.status=status;this.code=code;}
}
class InvalidInput extends ApiError {
  constructor(message){super(400,'INPUT_INVALID',message);}
}

function isBookmark(value) {
  if (!value || typeof value.title !== 'string' || !value.title.trim()
    || typeof value.url !== 'string') return false;
  try {
    const url = new URL(value.url);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

async function readBookmarks(file) {
  let contents;
  try {
    contents = await readFile(file, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
  let bookmarks;
  try { bookmarks = JSON.parse(contents); }
  catch { throw new ApiError(500,'STORAGE_INVALID','Bookmark storage is invalid'); }
  if (!Array.isArray(bookmarks) || !bookmarks.every(isBookmark)) {
    throw new ApiError(500,'STORAGE_INVALID','Bookmark storage is invalid');
  }
  return bookmarks;
}

async function writeBookmarks(file, bookmarks) {
  const temporaryFile = `${file}.${randomUUID()}.tmp`;
  const handle = await open(temporaryFile, 'wx');
  try {
    await handle.writeFile(JSON.stringify(bookmarks, null, 2) + '\n', 'utf8');
    await handle.sync();
    await handle.close();
    await rename(temporaryFile, file);
  } finally {
    await handle.close();
    await rm(temporaryFile, { force: true });
  }
}

async function readInput(request) {
  if((request.headers['content-type']||'').toLowerCase().split(';')[0].trim()!=='application/json')throw new ApiError(415,'CONTENT_TYPE_INVALID','Expected application/json');
  if(request.headers.origin){const address=request.socket.localAddress.includes(':')?'['+request.socket.localAddress+']':request.socket.localAddress;const allowed='http://'+address+':'+request.socket.localPort;if(request.headers.origin!==allowed)throw new ApiError(403,'ORIGIN_INVALID','Request origin is not allowed');}
  request.setEncoding('utf8');
  let body = '';
  for await (const chunk of request) body += chunk;
  let value;
  try {
    value = JSON.parse(body);
  } catch {
    throw new InvalidInput('Expected valid JSON with title and url');
  }
  if (!isBookmark(value)) {
    throw new InvalidInput('Title must not be blank and URL must use http or https');
  }
  return { title: value.title.trim(), url: value.url.trim() };
}

function sendJson(response, status, value) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(value));
}

export function createServer() {
  const bookmarksFile = resolve(process.env.BOOKMARKS_FILE || defaultBookmarksFile);
  let pending = Promise.resolve();
  // Serialize the full read/modify/write operation, including reads after writes.
  const withStorage = (operation) => {
    const result = pending.then(operation);
    pending = result.catch(() => {});
    return result;
  };

  return createHttpServer(async (request, response) => {
    try {
      const path = request.url.split('?', 1)[0];
      if (request.method === 'GET' && path === '/health') {
        sendJson(response, 200, { ok: true, version: process.env.ITERLANE_RELEASE_VERSION || 'v1' });
        return;
      }
      if (request.method === 'GET' && path === '/') {
        const html = await readFile(indexFile, 'utf8');
        response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        response.end(html);
        return;
      }
      const bookmarksPath=path==='/bookmarks'||path==='/api/bookmarks';
      if (request.method === 'GET' && bookmarksPath) {
        sendJson(response, 200, await withStorage(() => readBookmarks(bookmarksFile)));
        return;
      }
      if (request.method === 'POST' && bookmarksPath) {
        const bookmark = await readInput(request);
        await withStorage(async () => {
          const bookmarks = await readBookmarks(bookmarksFile);
          bookmarks.push(bookmark);
          await writeBookmarks(bookmarksFile, bookmarks);
        });
        sendJson(response, 201, bookmark);
        return;
      }
      sendJson(response, bookmarksPath?405:404, { error: {code:bookmarksPath?'METHOD_INVALID':'NOT_FOUND',message:bookmarksPath?'Method is not supported':'Not Found'} });
    } catch (error) {
      sendJson(response,error instanceof ApiError?error.status:500,{error:{code:error instanceof ApiError?error.code:'STORAGE_UNAVAILABLE',message:error instanceof ApiError?error.message:'Bookmark storage is unavailable'}});
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const server = createServer();
  let shuttingDown = false;
  const shutdown = () => {
    if (shuttingDown) return;
    shuttingDown = true;
    server.close((error) => {
      if (error) {
        console.error(error.message);
        process.exitCode = 1;
      }
    });
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
  server.once('close', () => {
    process.removeListener('SIGINT', shutdown);
    process.removeListener('SIGTERM', shutdown);
  });
  server.on('error', (error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
  server.listen(Number(process.env.PORT || 0), '127.0.0.1', () => {
    console.log(JSON.stringify({ port: server.address().port }));
  });
}
