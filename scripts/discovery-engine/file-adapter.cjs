const { openSync, fstatSync, readSync, closeSync, constants } = require('node:fs');
const { createHash } = require('node:crypto');
const { extname, basename } = require('node:path');

const required = ['nativeListingId', 'sourceUrl'];
const columns = [...required, 'name', 'status', 'vaccinated', 'photoUrl', 'sourceUpdatedAt'];
const maxBytes = 1024 * 1024;

function parseCsv(text) {
  const rows = [];
  let row = [], value = '', state = 'start';
  function field() { row.push(value); value = ''; state = 'start'; }
  function line() { field(); rows.push(row); row = []; }
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (state === 'quoted') {
      if (c === '"' && text[i+1] === '"') { value += '"'; i++; }
      else if (c === '"') state = 'closed';
      else value += c;
    } else if (c === ',') field();
    else if (c === '\r' || c === '\n') {
      if (c === '\r' && text[i+1] === '\n') i++;
      line();
    } else if (state === 'closed') throw Error('Unexpected text after closing quote');
    else if (c === '"') {
      if (state !== 'start') throw Error('Unexpected CSV quote');
      state = 'quoted';
    } else { value += c; state = 'bare'; }
  }
  if (state === 'quoted') throw Error('Unclosed CSV quote');
  if (row.length || state !== 'start') line();
  const headers = rows.shift() ?? [];
  if (new Set(headers).size !== headers.length || headers.some(key => !columns.includes(key)) ||
      required.some(key => !headers.includes(key))) throw Error('Invalid CSV headers');
  return rows.map(fields => {
    if (fields.length !== headers.length) throw Error('Wrong CSV field count');
    return Object.fromEntries(headers.map((key,i) => [key,fields[i]]));
  });
}

function fixtureUrl(value) {
  if (typeof value !== 'string' || !/^https:\/\//.test(value) || /[\s\\]/.test(value)) throw Error('Invalid fixture URL');
  const url = new URL(value);
  if (!url.hostname.endsWith('.invalid') || url.username || url.password || url.port) throw Error('Fixture URL must use .invalid');
  return value;
}

function observation(row, evidenceRef, observedAt) {
  if (!row || typeof row !== 'object' || Array.isArray(row) ||
      Object.keys(row).some(key => !columns.includes(key))) throw Error('Unexpected listing fields');
  const { nativeListingId, sourceUrl } = row;
  if (typeof nativeListingId !== 'string' || !/^[\w.-]{1,128}$/.test(nativeListingId)) throw Error('Invalid listing ID');
  const optional = key => row[key] === '' ? null : row[key] ?? null;
  const name = optional('name');
  const status = optional('status');
  const vaccination = optional('vaccinated');
  const photo = optional('photoUrl');
  const date = optional('sourceUpdatedAt');
  if (name !== null && (typeof name !== 'string' || !name.trim())) throw Error('Invalid listing name');
  if (![null,'active','reserved','unknown'].includes(status)) throw Error('Invalid status');
  if (![null,true,false,'true','false'].includes(vaccination)) throw Error('Invalid vaccination value');
  if (date !== null && (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d\d:\d\d:\d\dZ$/.test(date) ||
      !Number.isFinite(Date.parse(date)) || new Date(date).toISOString() !== date.replace(/Z$/, '.000Z'))) throw Error('Invalid source date');
  return {
    id:nativeListingId, nativeListingId, sourceUrl:fixtureUrl(sourceUrl), observedAt,
    evidenceRef, name, status, vaccinated:vaccination === null ? null : vaccination === true || vaccination === 'true',
    photoUrl:photo === null ? null : fixtureUrl(photo), sourceUpdatedAt:date,
  };
}

function enqueueFile(queue, { path, source, org }) {
  const grant = queue.fileGrant(source,org);
  if (!grant) throw Error('Source has no active synthetic file authorization');
  const extension = extname(path).toLowerCase();
  if (!['.csv','.json'].includes(extension)) throw Error('Expected CSV or JSON');
  const fd = openSync(path,constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  let bytes;
  try {
    if (!fstatSync(fd).isFile()) throw Error('Expected regular local file');
    const buffer = Buffer.alloc(maxBytes+1);
    let size = 0;
    while (size < buffer.length) {
      const count = readSync(fd,buffer,size,buffer.length-size,null);
      if (!count) break;
      size += count;
    }
    if (size > maxBytes) throw Error('File size exceeds 1 MiB');
    bytes = buffer.subarray(0,size);
  } finally { closeSync(fd); }
  const decoded = new TextDecoder('utf-8',{fatal:true}).decode(bytes);
  const rows = extension === '.csv' ? parseCsv(decoded) : JSON.parse(decoded);
  if (!Array.isArray(rows) || !rows.length || rows.length > 5000) throw Error('Expected 1–5000 listings');
  const digest = createHash('sha256').update(bytes).digest('hex');
  const run = JSON.stringify(['file-v1',source,grant.revision,extension,digest]);
  const tasks = rows.map((row,index) => ({
    key:String(index+1), row, evidenceRef:{file:basename(path), sha256:digest, record:index+1},
  }));
  queue.enqueueFileRun(run,source,org,grant.revision,tasks);
  return run;
}

module.exports = { enqueueFile, observation };
