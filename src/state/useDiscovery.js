import { useEffect, useReducer, useState } from 'react';
import { decode, emptyState, reducer } from './discovery.cjs';
import { read, write } from './storage';
const KEY='globis.choices.v1';
export default function useDiscovery() {
  const [initial] = useState(()=>{
    try { return {state:decode(read(KEY)),error:null}; }
    catch { return {state:emptyState(),error:'Nepavyko perskaityti pasirinkimų. Esami duomenys neperrašyti.'}; }
  });
  const [state,dispatch]=useReducer(reducer,initial.state);
  const [error,setError]=useState(initial.error);
  const [blocked,setBlocked]=useState(Boolean(initial.error));
  useEffect(()=>{
    if(blocked) return;
    try { write(KEY,JSON.stringify(state)); setError(null); }
    catch { setError('Nepavyko išsaugoti pasirinkimų šiame įrenginyje.'); }
  },[state,blocked]);
  const retry=()=>{setBlocked(false); try {write(KEY,JSON.stringify(state));setError(null);}catch {setError('Vietinė saugykla vis dar nepasiekiama.');}};
  return {state,dispatch,error,retry};
}
