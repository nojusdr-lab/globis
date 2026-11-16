const {resolve}=require('node:path');
const {Queue}=require('./queue.cjs');
const {enqueueFile}=require('./file-adapter.cjs');
const {runPool}=require('./workers.cjs');
const {ReviewStore}=require('./review-store.cjs');
async function main() {
 const [command,path,...args]=process.argv.slice(2);
 if(!['import','status','restore'].includes(command)||!path) throw Error('Usage: review-cli.cjs import DB FILE EXPECTED_COUNT | status DB | restore DB VERSION REASON');
 const source='synthetic-review',store=new ReviewStore(resolve(path));
 try {
  if(command==='status') return console.log(JSON.stringify({current:store.current(source),versions:store.versions(source),events:store.events(source)},null,2));
  if(command==='restore') {store.restore(source,args[0],args.slice(1).join(' '));return console.log('Restored reviewed synthetic version');}
  const queue=new Queue(':memory:');
  try {
   queue.register({org:'synthetic-org',source,domain:'shelter.invalid'});
   queue.authorizeSyntheticFile({source,allowed:true,expires:Date.now()+60000,evidence:'Local synthetic fixture review only; no real source or image license'});
   const run=enqueueFile(queue,{org:'synthetic-org',source,path:resolve(args[0])});
   await runPool(queue);
   const result=queue.publishPreview(run);
   if(!result.published) throw Error(`Worker preview rejected: ${JSON.stringify(result)}`);
   const items=JSON.parse(queue.get('SELECT data FROM snapshot WHERE source=?',source).data);
   // Local file digest is the stable import key. Observation time remains the actual adapter read time.
   const digest=items[0].evidenceRef.sha256;
   if(!Number.isSafeInteger(Number(args[1])) || items.length!==Number(args[1])) throw Error('Expected count mismatch');
   console.log(JSON.stringify(store.publish(source,items,{runId:digest,expectedCount:Number(args[1]),completed:true}),null,2));
  }catch(error){store.record(source,'import_error',error.message);throw error;}finally{queue.db.close();}
 }finally{store.close();}
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
