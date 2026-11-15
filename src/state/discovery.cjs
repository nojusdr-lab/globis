const emptyState = () => ({version:1, saved:[], passed:[], history:[], lang:'lt'});
const without = (ids,id) => ids.filter(value=>value!==id);
function restore(ids,id,index) {
  const result=without(ids,id);
  if(index>=0) result.splice(Math.min(index,result.length),0,id);
  return result;
}
function reducer(state,action) {
  if(action.type==='hydrate') return decode(JSON.stringify(action.state));
  if(action.type==='language') return {...state,lang:action.lang==='en'?'en':'lt'};
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
  return {...state,saved:action.type==='save'?[action.id,...without(state.saved,action.id)]:without(state.saved,action.id),passed:action.type==='pass'?[action.id,...without(state.passed,action.id)]:without(state.passed,action.id),history:[...state.history,entry].slice(-100)};
}
function decode(raw) {
  if(raw==null) return emptyState();
  const value=JSON.parse(raw);
  if(value.version!==1 || !['lt','en'].includes(value.lang) || !['saved','passed','history'].every(key=>Array.isArray(value[key]))) throw Error('Invalid saved choices');
  for(const key of ['saved','passed']) if(value[key].some(id=>typeof id!=='string') || new Set(value[key]).size!==value[key].length) throw Error('Invalid choice IDs');
  if(value.saved.some(id=>value.passed.includes(id)) || value.history.length>100 || value.history.some(e=>!e || typeof e.id!=='string' || !Number.isInteger(e.savedIndex) || !Number.isInteger(e.passedIndex) || e.savedIndex < -1 || e.passedIndex < -1)) throw Error('Invalid choice history');
  return {version:1,saved:value.saved,passed:value.passed,history:value.history,lang:value.lang};
}
const shouldClaim = ({dx,dy}) => Math.abs(dx)>8 && Math.abs(dx)>Math.abs(dy)*1.3;
module.exports={emptyState,reducer,decode,shouldClaim};
