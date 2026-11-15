const { setTimeout: sleep } = require('node:timers/promises');

async function fixtureAdapter(job, now) {
  await sleep(job.payload.delay ?? 5);
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
  await Promise.all(Array.from({length:size}, (_, index) => work('worker-' + (index + 1))));
  async function work(worker) {
    while (Date.now() < deadline) {
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
      const timer = setInterval(() => queue.renew(job,leaseMs),Math.max(1,Math.floor(leaseMs/3)));
      try {
        const item = await fixtureAdapter(job,queue.now);
        queue.complete(job,item);
      } catch (error) {
        queue.fail(job,error);
      } finally {
        clearInterval(timer);
      }
    }
    throw Error('Worker pool exceeded demo deadline');
  }
}

module.exports = { runPool };
