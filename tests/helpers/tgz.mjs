import fs from 'node:fs';
import {dirname, join} from 'node:path';
import {gunzipSync} from 'node:zlib';

const field = (header, start, length) => header.subarray(start, start + length).toString('utf8').replace(/\0[\s\S]*$/u, '');

// Extract a .tgz with Node alone. Host tar implementations disagree about Windows drive
// letters, and the packaged fixtures must unpack the same way on every supported host.
export function extractTgz(archive, destination) {
  const buffer = gunzipSync(fs.readFileSync(archive));
  let offset = 0;
  while (offset + 512 <= buffer.length) {
    const header = buffer.subarray(offset, offset + 512);
    if (header.every(byte => byte === 0)) break;
    const name = field(header, 0, 100);
    const prefix = field(header, 345, 155);
    const size = parseInt(field(header, 124, 12).trim() || '0', 8);
    const type = String.fromCharCode(header[156] || 48);
    if (Number.isNaN(size) || size < 0) throw new Error('Invalid tar entry size in ' + archive);
    offset += 512;
    const data = buffer.subarray(offset, offset + size);
    offset += Math.ceil(size / 512) * 512;
    const relative = prefix ? prefix + '/' + name : name;
    if (!relative || relative.startsWith('/') || relative.split('/').includes('..')) continue;
    const target = join(destination, relative);
    if (type === '5') { fs.mkdirSync(target, {recursive: true}); continue; }
    // Extended headers (x/g) and links (1/2) carry no file body we need from these fixtures.
    if (type !== '0' && type !== '\0') continue;
    fs.mkdirSync(dirname(target), {recursive: true});
    fs.writeFileSync(target, data);
  }
}
