const emptyState = (lang='lt') => ({version:1, saved:[], passed:[], history:[], lang:lang==='en'?'en':'lt'});
// First launch only: a phone set to a known non-Lithuanian language starts in English. Unknown stays Lithuanian.
const langFromLocale = locale => { const tag=String(locale||'').trim().toLowerCase(); return tag && !/^lt\b/.test(tag) ? 'en' : 'lt'; };
const without = (ids,id) => ids.filter(value=>value!==id);
// A saved animal's last seen card, so it stays recognisable in Saved after the shelter stops listing it.
const SNAP_KEYS=['name','photo','city','shelter','url','species'];
function cleanSnap(x) {
  if(!x||typeof x!=='object') return null;
  const out={};
  for(const k of SNAP_KEYS) if(typeof x[k]==='string'&&x[k]&&x[k].length<=500) out[k]=x[k];
  return out.name?out:null;
}
function restore(ids,id,index) {
  const result=without(ids,id);
  if(index>=0) result.splice(Math.min(index,result.length),0,id);
  return result;
}
function reducer(state,action) {
  if(action.type==='hydrate') return decode(JSON.stringify(action.state));
  if(action.type==='language') return {...state,lang:action.lang==='en'?'en':'lt'};
  if(action.type==='filters') return {...state,filters:cleanFilters(action.filters)};
  if(action.type==='onboarded') return {...state,onboarded:true,filters:cleanFilters(action.filters||state.filters)};
  if(action.type==='replayOnboarding') { const {onboarded,...rest}=state; return rest; }
  // Server saves join the device's list (union). Always a new array, so the sync effect runs once after sign-in.
  if(action.type==='mergeSaved') return {...state,saved:[...state.saved,...(action.ids||[]).filter(id=>typeof id==='string'&&!state.saved.includes(id))]};
  if(action.type==='remove') return {...state,saved:without(state.saved,action.id),history:[]};
  if(action.type==='resetPassed') return {...state,passed:[],history:[]};
  if(action.type==='undo') {
    const last=state.history.at(-1);
    return last ? {...state,saved:restore(state.saved,last.id,last.savedIndex),passed:restore(state.passed,last.id,last.passedIndex),history:state.history.slice(0,-1)} : state;
  }
  if(!['save','pass'].includes(action.type) || typeof action.id!=='string') return state;
  if(action.type==='save' && state.saved.includes(action.id)) return state;
  if(action.type==='pass' && state.passed.includes(action.id)) return state;
  const entry={id:action.id,savedIndex:state.saved.indexOf(action.id),passedIndex:state.passed.indexOf(action.id)};
  const snap=action.type==='save'?cleanSnap(action.snap):null;
  if(snap) state={...state,snaps:{...state.snaps,[action.id]:snap}};
  return {...state,saved:action.type==='save'?[action.id,...without(state.saved,action.id)]:without(state.saved,action.id),passed:action.type==='pass'?[action.id,...without(state.passed,action.id)]:without(state.passed,action.id),history:[...state.history,entry].slice(-100)};
}
// Only the four known filter keys with valid types survive; anything else falls back to the default.
function cleanFilters(f) {
  f=f||{};
  return {species:['all','dog','cat'].includes(f.species)?f.species:'all',city:typeof f.city==='string'&&f.city?f.city:'all',urgent:f.urgent===true,query:typeof f.query==='string'?f.query:''};
}
function decode(raw) {
  if(raw==null) return emptyState();
  const value=JSON.parse(raw);
  if(value.version!==1 || !['lt','en'].includes(value.lang) || !['saved','passed','history'].every(key=>Array.isArray(value[key]))) throw Error('Invalid saved choices');
  for(const key of ['saved','passed']) if(value[key].some(id=>typeof id!=='string') || new Set(value[key]).size!==value[key].length) throw Error('Invalid choice IDs');
  if(value.saved.some(id=>value.passed.includes(id)) || value.history.length>100 || value.history.some(e=>!e || typeof e.id!=='string' || !Number.isInteger(e.savedIndex) || !Number.isInteger(e.passedIndex) || e.savedIndex < -1 || e.passedIndex < -1)) throw Error('Invalid choice history');
  const out={version:1,saved:value.saved,passed:value.passed,history:value.history,lang:value.lang};
  if(value.onboarded===true) out.onboarded=true;
  if(value.filters) out.filters=cleanFilters(value.filters);
  if(value.snaps&&typeof value.snaps==='object') {
    const snaps=Object.fromEntries(Object.entries(value.snaps).filter(([id])=>value.saved.includes(id)).map(([id,v])=>[id,cleanSnap(v)]).filter(([,v])=>v));
    if(Object.keys(snaps).length) out.snaps=snaps;
  }
  return out;
}
// What to send to the server so it matches the device's saved list.
function syncPlan(saved,remote) {
  return {add:saved.filter(id=>!remote.has(id)),drop:[...remote].filter(id=>!saved.includes(id))};
}

module.exports={emptyState,langFromLocale,reducer,decode,cleanFilters,syncPlan};
