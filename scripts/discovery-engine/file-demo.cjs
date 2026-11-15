const { join } = require('node:path');
const { Queue } = require('./queue.cjs');
const { enqueueFile } = require('./file-adapter.cjs');
const { runPool } = require('./workers.cjs');

async function main() {
  const queue = new Queue(':memory:');
  try {
    const runs = ['a','b','c'].map(org => {
      queue.register({org,source:org,domain:org+'.invalid'});
      queue.authorizeSyntheticFile({
        source:org, allowed:true, expires:Date.now()+60000, evidence:'Repository synthetic CSV fixture',
      });
      return enqueueFile(queue,{org,source:org,path:join(__dirname,'fixtures','synthetic.csv')});
    });
    await runPool(queue,{onEvent:({worker,org,key})=>console.log(worker,org,'record',key)});
    for (const run of runs) {
      const result = queue.publishPreview(run);
      if (!result.published) throw Error(JSON.stringify(result));
    }
    for (const {source,data} of queue.all('SELECT source,data FROM snapshot ORDER BY source')) {
      console.log(source, JSON.parse(data).map(({nativeListingId,status})=>[nativeListingId,status]));
    }
  } finally { queue.db.close(); }
}
main().catch(error=>{ console.error(error); process.exitCode=1; });
