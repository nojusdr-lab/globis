const { randomUUID } = require('node:crypto');
const { setTimeout: sleep } = require('node:timers/promises');
const { Queue } = require('./queue.cjs');
const { runPool } = require('./workers.cjs');

async function main() {
  const queue = new Queue(process.argv[2] || ':memory:');
  const prefix = randomUUID();
  try {
    for (const [org, count, domain] of [['A',7,'shared.invalid'],['B',2,'shared.invalid'],['C',3,'other.invalid']]) {
      queue.register({org,source:org,domain});
      queue.enqueue(prefix+org,org,Array.from({length:count},(_,i)=>({
        key:org+'-'+i, delay:org==='A'?5:12, failFirst:org==='C'&&i===0,
      })));
    }
    const abandoned = queue.claim('abandoned-worker',{leaseMs:10});
    console.log('Abandoned lease:', abandoned.org, abandoned.key);
    await sleep(15);
    const previous = new Map();
    let switches = 0;
    await runPool(queue,{onEvent(event) {
      const from = previous.get(event.worker);
      if (from && from !== event.org) {
        console.log(event.worker + ': ' + from + ' → ' + event.org);
        switches++;
      }
      previous.set(event.worker,event.org);
      console.log(event.worker,event.org,event.key,'attempt',event.token);
    }});
    if (!switches) throw Error('Expected a worker to switch organizations');
    for (const org of ['A','B','C']) {
      const result = queue.publishPreview(prefix+org);
      if (!result.published) throw Error('Snapshot rejected: '+org+' '+JSON.stringify(result));
      const snapshot = queue.get('SELECT data FROM snapshot WHERE source=?',org);
      console.log('Validated preview:',org,JSON.parse(snapshot.data).length,'observations');
    }
  } finally {
    queue.db.close();
  }
}
main().catch(error => { console.error(error); process.exitCode=1; });
