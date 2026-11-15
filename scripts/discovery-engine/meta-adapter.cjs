const { createHash } = require('node:crypto');

const domain = 'graph.facebook.com';
const states = ['unconfigured','review_required','approved','expired','revoked','unsupported'];

function sourceState(queue, source) {
  const decision = queue.get('SELECT * FROM meta_access WHERE source=? ORDER BY revision DESC LIMIT 1',source);
  if (!decision) return {state:'unconfigured', connection:'not_connected'};
  const state = decision.state === 'approved' && decision.expires <= queue.now() ? 'expired' : decision.state;
  return { ...decision, state, connection:'not_connected' };
}

function recordDecision(queue, {source, state, pageId, route, expires = null, evidence}) {
  if (!states.includes(state) || typeof evidence !== 'string' || !evidence.trim() ||
      !/^\d{1,32}$/.test(pageId) || typeof pageId !== 'string' ||
      !['page_oauth','ppca'].includes(route) ||
      (state === 'approved' && (!Number.isSafeInteger(expires) || expires <= queue.now()))) {
    throw Error('Invalid synthetic Meta access decision');
  }
  return queue.tx(() => {
    if (!queue.get("SELECT id FROM source WHERE id=? AND domain=? AND mode='fixture'",source,domain)) {
      throw Error('Meta C1 requires a fixture source on the shared Graph domain');
    }
    const prior = sourceState(queue,source);
    queue.sql('INSERT INTO meta_access VALUES (?,?,?,?,?,?,?,?)',
      source,(prior.revision ?? 0)+1,state,pageId,route,expires,evidence,queue.now());
  });
}

function enqueueMeta(queue, {source, org, fixture}) {
  return queue.tx(() => {
    const access = sourceState(queue,source);
    if (access.state !== 'approved' ||
        !queue.get(`SELECT s.id FROM source s JOIN organization o ON o.id=s.org
          WHERE s.id=? AND o.id=? AND o.active=1`,source,org)) throw Error('Meta fixture access denied');
    if (fixture?.synthetic !== true || fixture.pageId !== access.page_id || !Array.isArray(fixture.pages) ||
        fixture.pages.length < 1 || fixture.pages.length > 20) throw Error('Expected scoped synthetic Meta fixture');
    if (Buffer.byteLength(JSON.stringify(fixture)) > 1024*1024) throw Error('Meta fixture is too large');
    const safeFixture = {pageId:fixture.pageId, pages:fixture.pages.map(({cursor,responses})=>({
      cursor,
      responses:responses.map(({status,headers,body})=>({
        status, headers:{'retry-after':headers?.['retry-after']},
        body:{
          error:body?.error && {code:body.error.code,error_subcode:body.error.error_subcode,is_transient:body.error.is_transient},
          data:Array.isArray(body?.data) ? body.data.map(post=>({
            id:post?.id,message:post?.message,created_time:post?.created_time,
            permalink_url:post?.permalink_url,full_picture:post?.full_picture,is_published:post?.is_published,
          })) : null,
          paging:body?.paging?.next == null ? null : {next:true,cursors:{after:body.paging.cursors?.after}},
        },
      })),
    }))};
    const bytes = JSON.stringify(safeFixture);
    const digest = createHash('sha256').update(bytes).digest('hex');
    const run = JSON.stringify(['meta-c1',source,access.revision,digest]);
    if (queue.get('SELECT run FROM meta_run WHERE run=?',run)) return run;
    queue.insertRun(run,source,[{key:'pages',fixture:safeFixture,digest}]);
    queue.sql('INSERT INTO meta_run VALUES (?,?,?)',run,access.revision,new Date(queue.now()).toISOString());
    return run;
  });
}

function classify(response, now) {
  const code = response.body?.error?.code;
  const subcode = response.body?.error?.error_subcode;
  const status = response.status;
  if (status === 429 || [4,17,32,613,80001].includes(code)) {
    const raw = response.headers?.['retry-after'];
    const delay = typeof raw === 'string' && /^\d{1,9}$/.test(raw) ? Number(raw)*1000 :
      typeof raw === 'string' && raw.includes('GMT') ? Date.parse(raw)-now : 0;
    return {kind:'rate_limited', retry:true, cooldown:true, delayMs:Number.isFinite(delay) ? Math.max(0,delay) : 0};
  }
  if (code === 190 || code === 102 || status === 401) return {kind:'token_invalid',retry:false};
  if (status === 403 || code === 10 || [200,283].includes(code)) return {kind:'permission_denied',retry:false};
  if (status === 404 || (code === 100 && subcode === 33)) return {kind:'unavailable_unconfirmed',retry:false};
  if (status >= 500 || response.body?.error?.is_transient === true) return {kind:'transient',retry:true};
  if (status !== 200 || response.body?.error) return {kind:'invalid_response',retry:false};
  return null;
}

function fixtureUrl(value) {
  if (typeof value !== 'string' || !/^https:\/\//.test(value) || /[\s\\]/.test(value)) throw Error('Invalid synthetic URL');
  const url = new URL(value);
  if (!url.hostname.endsWith('.invalid') || url.username || url.password || url.port) throw Error('Expected .invalid URL');
  return url.href;
}

function normalize(post, job, record) {
  const {fixture,digest} = job.payload;
  if (typeof post?.id !== 'string' || !new RegExp('^'+fixture.pageId+'_\\d{1,32}$').test(post.id)) {
    throw Error('Post outside approved Page');
  }
  const message = post.message ?? null;
  if (message !== null && typeof message !== 'string') throw Error('Invalid post message');
  if (typeof post.created_time !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(Z|[+-]\d{4})$/.test(post.created_time) ||
      !Number.isFinite(Date.parse(post.created_time)) ||
      new Date(post.created_time.slice(0,10)+'T00:00:00Z').toISOString().slice(0,10) !== post.created_time.slice(0,10)) throw Error('Invalid post timestamp');
  const marker = message?.split(/\r?\n/).find(line => /^\s*(?:būsena:\s*)?rezervuot(?:as|a)\s*[.!]?\s*$/iu.test(line)) ?? null;
  return {
    id:post.id,nativeListingId:post.id,sourceUrl:fixtureUrl(post.permalink_url),
    observedAt:job.meta_observed_at,postedAt:new Date(post.created_time).toISOString(),sourceUpdatedAt:null,
    sourceId:job.source,organizationId:job.org,pageId:fixture.pageId,
    evidenceRef:{kind:'synthetic_meta_fixture',sha256:digest,record},
    message,status:marker ? 'reserved' : null,statusEvidence:marker,
    vaccinated:null,
    media:post.full_picture == null ? [] : [{url:fixtureUrl(post.full_picture),rights:'unknown'}],
  };
}

function executeMetaFixture(job, now) {
  const {pages} = job.payload.fixture;
  const items = [];
  const seen = new Set();
  let cursor = null;
  for (const [index,page] of pages.entries()) {
    if (page.cursor !== cursor || !Array.isArray(page.responses) || !page.responses.length) throw Error('Invalid fixture pagination');
    const response = page.responses[Math.min(job.token-1,page.responses.length-1)];
    const error = classify(response,now);
    if (error) throw Object.assign(new Error(error.kind),{metaFailure:error});
    if (!Array.isArray(response.body?.data)) throw Error('Missing Page data');
    for (const [row,post] of response.body.data.entries()) {
      if (post.is_published === false) continue;
      if (post.is_published !== true) throw Error('Missing publication evidence');
      items.push(normalize(post,job,{page:index+1,row:row+1}));
    }
    const paging = response.body.paging;
    if (paging?.next == null) {
      if (index !== pages.length-1) throw Error('Unreachable fixture page');
      return {items};
    }
    // Treat next only as a continuation flag; never request or propagate its URL.
    cursor = paging.cursors?.after;
    if (typeof cursor !== 'string' || !cursor || seen.has(cursor)) throw Error('Missing or repeated cursor');
    seen.add(cursor);
  }
  throw Error('Incomplete Page fixture');
}

module.exports = { sourceState, recordDecision, enqueueMeta, executeMetaFixture, classify };
