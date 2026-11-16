import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { request as httpRequest } from 'node:http';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

function request(port, path, method = 'GET', payload) {
  return new Promise((resolve, reject) => {
    const data = payload === undefined ? undefined
      : typeof payload === 'string' ? payload : JSON.stringify(payload);
    const headers = data === undefined ? {} : {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(data),
    };
    const req = httpRequest({ host: '127.0.0.1', port, path, method, headers, agent: false }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { body += chunk; });
      res.on('error', reject);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on('error', reject);
    req.setTimeout(2000, () => req.destroy(new Error('HTTP request timed out')));
    req.end(data);
  });
}

async function startServer(t, version) {
  const previous = process.env.ITERLANE_RELEASE_VERSION;
  if (version === undefined) delete process.env.ITERLANE_RELEASE_VERSION;
  else process.env.ITERLANE_RELEASE_VERSION = version;
  t.after(() => {
    if (previous === undefined) delete process.env.ITERLANE_RELEASE_VERSION;
    else process.env.ITERLANE_RELEASE_VERSION = previous;
  });
  const { createServer } = await import('../server.mjs');
  const server = createServer();
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return server.address().port;
}

test('GET /health returns 200 JSON and defaults the release version to v1', { timeout: 5000 }, async (t) => {
  const port = await startServer(t);
  const response = await request(port, '/health');
  assert.equal(response.status, 200);
  assert.match(response.headers['content-type'], /^application\/json\b/);
  assert.deepEqual(JSON.parse(response.body), { ok: true, version: 'v1' });
});

test('GET /health reports ITERLANE_RELEASE_VERSION', { timeout: 5000 }, async (t) => {
  const port = await startServer(t, 'v2-test');
  const response = await request(port, '/health');
  assert.equal(response.status, 200);
  assert.deepEqual(JSON.parse(response.body), { ok: true, version: 'v2-test' });
});

test('an empty release version falls back to v1', { timeout: 5000 }, async (t) => {
  const port = await startServer(t, '');
  const response = await request(port, '/health');
  assert.equal(response.status, 200);
  assert.deepEqual(JSON.parse(response.body), { ok: true, version: 'v1' });
});

test('an unknown route returns 404', { timeout: 5000 }, async (t) => {
  const port = await startServer(t);
  const response = await request(port, '/missing');
  assert.equal(response.status, 404);
});

test('POST /health does not match the GET health route', { timeout: 5000 }, async (t) => {
  const port = await startServer(t);
  const response = await request(port, '/health', 'POST');
  assert.equal(response.status, 404);
});

for (const explicitPort of [false, true]) {
  test(`CLI ${explicitPort ? 'honors PORT' : 'defaults PORT to 0'} and closes through its signal handler`, { timeout: 8000 }, async (t) => {
    const env = { ...process.env, ITERLANE_RELEASE_VERSION: 'cli-test' };
    delete env.PORT;
    let expectedPort;
    if (explicitPort) {
      // Let the OS choose a free port, then release it for this CLI process.
      const { createServer } = await import('../server.mjs');
      const probe = createServer();
      probe.listen(0, '127.0.0.1');
      await once(probe, 'listening');
      expectedPort = probe.address().port;
      await new Promise((resolve, reject) => probe.close((error) => error ? reject(error) : resolve()));
      env.PORT = String(expectedPort);
    }
    // Windows child.kill() terminates immediately. Forward the event over IPC
    // so the real CLI's SIGTERM handler can close its HTTP server and exit.
    const bridge = "process.once('message', signal => { process.disconnect(); process.emit(signal); });";
    const child = spawn(process.execPath, [
      '--import', `data:text/javascript,${encodeURIComponent(bridge)}`,
      fileURLToPath(new URL('../server.mjs', import.meta.url)),
    ], { env, stdio: ['ignore', 'pipe', 'pipe', 'ipc'], windowsHide: true });
    const exited = once(child, 'exit');
    const lines = [];
    let stderr = '';
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    const output = createInterface({ input: child.stdout });
    output.on('line', (line) => lines.push(line));
    t.after(async () => {
      output.close();
      if (child.exitCode === null && child.signalCode === null) child.kill();
      await exited;
    });
    const [line] = await Promise.race([
      once(output, 'line'),
      exited.then(([code]) => { throw new Error(`CLI exited before startup (${code}): ${stderr}`); }),
    ]);
    const address = JSON.parse(line);
    assert.deepEqual(Object.keys(address), ['port']);
    assert.ok(Number.isInteger(address.port) && address.port > 0 && address.port <= 65535);
    if (explicitPort) assert.equal(address.port, expectedPort);
    const response = await request(address.port, '/health');
    assert.equal(response.status, 200);
    assert.deepEqual(JSON.parse(response.body), { ok: true, version: 'cli-test' });
    child.send('SIGTERM');
    assert.deepEqual(await exited, [0, null]);
    assert.deepEqual(lines, [line]);
    assert.equal(stderr, '');
    await assert.rejects(request(address.port, '/health'), { code: 'ECONNREFUSED' });
  });
}

async function bookmarkFixture(t, contents) {
  const temporaryRoot = resolve(tmpdir());
  const directory = await mkdtemp(join(temporaryRoot, 'iterlane-T2-'));
  const file = join(directory, 'bookmarks.json');
  const services = [];
  t.after(async () => {
    try {
      const results = await Promise.allSettled(services.map((service) => service.stop()));
      for (const result of results) {
        if (result.status === 'rejected') throw result.reason;
      }
    } finally {
      assert.equal(dirname(directory), temporaryRoot);
      assert.ok(basename(directory).startsWith('iterlane-T2-'));
      await rm(directory, { recursive: true, force: true });
    }
  });
  if (contents !== undefined) await writeFile(file, contents, 'utf8');

  return {
    file,
    async start() {
      const bridge = "process.once('message', signal => { process.disconnect(); process.emit(signal); });";
      const child = spawn(process.execPath, [
        '--import', `data:text/javascript,${encodeURIComponent(bridge)}`,
        fileURLToPath(new URL('../server.mjs', import.meta.url)),
      ], {
        env: { ...process.env, PORT: '0', BOOKMARKS_FILE: file },
        stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
        windowsHide: true,
      });
      const exited = once(child, 'exit');
      let stderr = '';
      child.stderr.setEncoding('utf8');
      child.stderr.on('data', (chunk) => { stderr += chunk; });
      const output = createInterface({ input: child.stdout });
      let stopped;
      const service = {
        stop() {
          return stopped ??= (async () => {
            output.close();
            if (child.exitCode === null && child.signalCode === null) {
              if (child.connected) child.send('SIGTERM');
              else child.kill();
            }
            assert.deepEqual(await exited, [0, null], stderr);
            assert.equal(stderr, '');
          })();
        },
      };
      services.push(service);
      const [line] = await Promise.race([
        once(output, 'line'),
        exited.then(([code]) => { throw new Error(`CLI exited before startup (${code}): ${stderr}`); }),
      ]);
      const address = JSON.parse(line);
      assert.deepEqual(Object.keys(address), ['port']);
      assert.ok(Number.isInteger(address.port) && address.port > 0 && address.port <= 65535);
      return { ...service, port: address.port };
    },
  };
}

test('bookmarks API creates, lists and writes JSON through real HTTP', { timeout: 8000 }, async (t) => {
  const fixture = await bookmarkFixture(t);
  const server = await fixture.start();
  const initial = await request(server.port, '/api/bookmarks');
  assert.equal(initial.status, 200);
  assert.match(initial.headers['content-type'], /^application\/json\b/);
  assert.deepEqual(JSON.parse(initial.body), []);

  const bookmark = { title: 'Node.js', url: 'https://nodejs.org/en/' };
  const created = await request(server.port, '/api/bookmarks', 'POST', bookmark);
  assert.equal(created.status, 201);
  assert.deepEqual(JSON.parse(created.body), bookmark);
  const listed = await request(server.port, '/api/bookmarks');
  assert.equal(listed.status, 200);
  assert.deepEqual(JSON.parse(listed.body), [bookmark]);
  assert.deepEqual(JSON.parse(await readFile(fixture.file, 'utf8')), [bookmark]);
});

test('bookmarks survive a CLI restart and subsequent additions keep saved entries', { timeout: 8000 }, async (t) => {
  const fixture = await bookmarkFixture(t);
  const first = await fixture.start();
  const bookmark = { title: 'Saved before restart', url: 'http://example.com/first' };
  assert.equal((await request(first.port, '/api/bookmarks', 'POST', bookmark)).status, 201);
  await first.stop();

  const restarted = await fixture.start();
  const restored = await request(restarted.port, '/api/bookmarks');
  assert.equal(restored.status, 200);
  assert.deepEqual(JSON.parse(restored.body), [bookmark]);
  const another = { title: 'Saved after restart', url: 'https://example.com/second' };
  assert.equal((await request(restarted.port, '/api/bookmarks', 'POST', another)).status, 201);
  assert.deepEqual(JSON.parse(await readFile(fixture.file, 'utf8')), [bookmark, another]);
});

test('invalid bookmark input returns 400 without changing stored data', { timeout: 8000 }, async (t) => {
  const saved = [{ title: 'Existing bookmark', url: 'https://example.com/saved' }];
  const original = JSON.stringify(saved, null, 2) + '\n';
  const fixture = await bookmarkFixture(t, original);
  const server = await fixture.start();
  const invalid = [
    { title: '', url: 'https://example.com/' },
    { title: ' \t\r\n ', url: 'https://example.com/' },
    { title: null, url: 'https://example.com/' },
    { url: 'https://example.com/' },
    { title: 'Bad URL', url: 'javascript:alert(1)' },
    { title: 'Bad URL', url: 'ftp://example.com/' },
    { title: 'Bad URL', url: 'data:text/html,<script>alert(1)</script>' },
    { title: 'Bad URL', url: '/relative' },
    { title: 'Bad URL', url: 'https://' },
    { title: 'Bad URL', url: '' },
    null,
    '{"title":',
  ];
  for (const payload of invalid) {
    const response = await request(server.port, '/api/bookmarks', 'POST', payload);
    assert.equal(response.status, 400, JSON.stringify(payload));
    assert.equal(typeof JSON.parse(response.body).error.message, 'string');
    assert.equal(JSON.parse(response.body).error.code, 'INPUT_INVALID');
    assert.equal(await readFile(fixture.file, 'utf8'), original);
  }
  const listed = await request(server.port, '/api/bookmarks');
  assert.equal(listed.status, 200);
  assert.deepEqual(JSON.parse(listed.body), saved);
});

test('concurrent HTTP additions keep every bookmark in JSON storage', { timeout: 8000 }, async (t) => {
  const saved = { title: 'Existing', url: 'https://example.com/existing' };
  const fixture = await bookmarkFixture(t, JSON.stringify([saved]));
  const server = await fixture.start();
  const additions = Array.from({ length: 24 }, (_, index) => ({
    title: `Concurrent ${index}`,
    url: `https://example.com/${index}`,
  }));
  const responses = await Promise.all(additions.map((bookmark) =>
    request(server.port, '/api/bookmarks', 'POST', bookmark)));
  for (let index = 0; index < responses.length; index++) {
    assert.equal(responses[index].status, 201);
    assert.deepEqual(JSON.parse(responses[index].body), additions[index]);
  }
  const listed = await request(server.port, '/api/bookmarks');
  assert.equal(listed.status, 200);
  const actual = JSON.parse(listed.body);
  const byTitle = (left, right) => left.title.localeCompare(right.title);
  assert.deepEqual(actual.toSorted(byTitle), [saved, ...additions].toSorted(byTitle));
  assert.deepEqual(JSON.parse(await readFile(fixture.file, 'utf8')), actual);
});

test('corrupt bookmark storage reports errors and preserves the original bytes', { timeout: 8000 }, async (t) => {
  for (const original of ['{"broken":', '{}']) {
    const fixture = await bookmarkFixture(t, original);
    const server = await fixture.start();
    const listed = await request(server.port, '/api/bookmarks');
    assert.equal(listed.status, 500);
    assert.equal(typeof JSON.parse(listed.body).error.message, 'string');
    assert.equal(JSON.parse(listed.body).error.code, 'STORAGE_INVALID');
    assert.equal(await readFile(fixture.file, 'utf8'), original);
    const created = await request(server.port, '/api/bookmarks', 'POST', {
      title: 'Must not replace corrupt data', url: 'https://example.com/',
    });
    assert.equal(created.status, 500);
    assert.equal(await readFile(fixture.file, 'utf8'), original);
    assert.equal((await request(server.port, '/health')).status, 200);
  }
});

test('GET / serves an HTML bookmark form with title and URL labels', { timeout: 8000 }, async (t) => {
  const fixture = await bookmarkFixture(t);
  const server = await fixture.start();
  const response = await request(server.port, '/');
  assert.equal(response.status, 200);
  assert.match(response.headers['content-type'], /^text\/html\b/);
  assert.match(response.body, /<form\b/);
  assert.match(response.body, /<label\b[^>]*for="title"[^>]*>\s*标题\s*<\/label>/);
  assert.match(response.body, /<input\b[^>]*id="title"[^>]*name="title"/);
  assert.match(response.body, /<label\b[^>]*for="url"[^>]*>\s*网址\s*<\/label>/);
  assert.match(response.body, /<input\b[^>]*id="url"[^>]*name="url"/);
});
