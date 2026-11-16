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
  const retry=()=>{
    try {
      if(blocked) {
        // Retry reading the original bytes. Never replace an unreadable saved state with defaults.
        const restored=decode(read(KEY));
        dispatch({type:'hydrate',state:restored});
        setBlocked(false);
      } else write(KEY,JSON.stringify(state));
      setError(null);
    } catch {setError('Vietinė saugykla vis dar nepasiekiama arba duomenys netinkami. Esami duomenys neperrašyti.');}
  };
  return {state,dispatch,error,retry};
}
