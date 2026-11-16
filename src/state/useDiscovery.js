import { useEffect, useReducer, useState } from 'react';
import { decode, emptyState, langFromLocale, reducer } from './discovery.cjs';
import { read, write } from './storage';
const KEY='globis.choices.v1';
function deviceLocale() {
  try { return (typeof navigator!=='undefined'&&navigator.language) || Intl.DateTimeFormat().resolvedOptions().locale; }
  catch { return ''; }
}
// Errors are returned as codes so the screen can show them in the current language.
export default function useDiscovery() {
  const [initial] = useState(()=>{
    try { const raw=read(KEY); return {state:raw==null?emptyState(langFromLocale(deviceLocale())):decode(raw),error:null}; }
    catch { return {state:emptyState(langFromLocale(deviceLocale())),error:'read'}; }
  });
  const [state,dispatch]=useReducer(reducer,initial.state);
  const [error,setError]=useState(initial.error);
  const [blocked,setBlocked]=useState(Boolean(initial.error));
  useEffect(()=>{
    if(blocked) return;
    try { write(KEY,JSON.stringify(state)); setError(null); }
    catch { setError('write'); }
  },[state,blocked]);
  const retry=()=>{
    try {
      if(blocked) {
        // Retry reading the original bytes. Never replace an unreadable saved state with defaults.
        const restored=decode(read(KEY));
        dispatch({type:'hydrate',state:restored});
        setBlocked(false);
      } else write(KEY,JSON.stringify(state));
      setError(null);
    } catch {setError('retry');}
  };
  return {state,dispatch,error,retry};
}
