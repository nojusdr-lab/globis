const { setTimeout: sleep } = require('node:timers/promises');

async function fixtureAdapter(job, now, signal) {
  await sleep(job.payload.delay ?? 5, undefined, {signal});
  if (job.payload.fail || (job.payload.failFirst && job.token === 1)) throw Error('Fixture failure');
  return {
    id: job.key,
    sourceUrl: 'https://' + job.domain + '/' + encodeURIComponent(job.key),
    observedAt: new Date(now()).toISOString(),
    vaccinated: job.payload.vaccinated ?? null,
  };
}

async function runPool(queue, { size = 3, leaseMs = 1000, deadlineMs = 5000, onEvent = () => {} } = {}) {
  const deadline = Date.now() + deadlineMs;
  let stopping = false;
  const results = await Promise.allSettled(Array.from({length:size}, (_, index) =>
    work('worker-' + (index + 1)).catch(error => {
      stopping = true;
      throw error;
    })));
  const failure = results.find(result => result.status === 'rejected');
  if (failure) throw failure.reason;
  async function work(worker) {
    while (!stopping && Date.now() < deadline) {
      const job = queue.claim(worker, { leaseMs });
      if (!job) {
        const pending = queue.get(`SELECT 1 FROM job j JOIN run r ON r.id=j.run
          JOIN source s ON s.id=r.source JOIN organization o ON o.id=s.org
          WHERE s.mode='fixture' AND o.active=1 AND j.state IN ('ready','leased') LIMIT 1`);
        if (!pending) return;
        await sleep(5);
        continue;
      }
      onEvent({worker, org:job.org, key:job.key, token:job.token});
      const controller = new AbortController();
      let heartbeatError;
      const timer = setInterval(() => {
        try {
          if (!queue.renew(job,leaseMs)) controller.abort();
        } catch (error) {
          heartbeatError = error;
          controller.abort();
        }
      },Math.max(1,Math.floor(leaseMs/3)));
      let item;
      let adapterError;
      try {
        item = await fixtureAdapter(job,queue.now,controller.signal);
      } catch (error) {
        adapterError = error;
      } finally {
        clearInterval(timer);
      }
      if (heartbeatError) throw new Error('Worker heartbeat failed', { cause: heartbeatError });
      if (controller.signal.aborted) continue;
      if (adapterError) queue.fail(job,adapterError);
      else queue.complete(job,item);
    }
    if (!stopping) throw Error('Worker pool exceeded demo deadline');
  }
}

module.exports = { runPool };
