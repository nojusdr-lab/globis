// Optional account (email code). Signed in: saved animals sync both ways with public.saved.
// Signed out: nothing changes, saving stays on the device.
import {useEffect,useRef,useState} from 'react';
import {supabase} from '../data/supabase';
import {syncPlan} from './discovery.cjs';

export default function useAccount(saved, dispatch) {
  const [session, setSession] = useState(null);
  const remote = useRef(null); // animal ids known to be on the server; null until the first fetch
  const user = session?.user ?? null;

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({data}) => setSession(data.session));
    const {data} = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  // First fetch after sign-in: bring server saves onto this device.
  useEffect(() => {
    remote.current = null;
    if (!user) return;
    let live = true;
    supabase.from('saved').select('animal_id').then(({data, error}) => {
      if (!live || error) return;
      remote.current = new Set(data.map(r => r.animal_id));
      dispatch({type: 'mergeSaved', ids: [...remote.current]});
    });
    return () => { live = false; };
  }, [user?.id]);

  // After that, every local change is mirrored to the server.
  useEffect(() => {
    if (!user || !remote.current) return;
    const {add, drop} = syncPlan(saved, remote.current);
    for (const id of add) remote.current.add(id);
    for (const id of drop) remote.current.delete(id);
    if (add.length) supabase.from('saved').insert(add.map(animal_id => ({user_id: user.id, animal_id}))).then(() => {});
    if (drop.length) supabase.from('saved').delete().in('animal_id', drop).then(() => {});
  }, [saved, user?.id, remote.current]);

  return {
    available: !!supabase,
    email: user?.email ?? null,
    sendCode: email => supabase.auth.signInWithOtp({email, options: {shouldCreateUser: true}}),
    verify: (email, token) => supabase.auth.verifyOtp({email, token, type: 'email'}),
    signOut: () => supabase.auth.signOut(),
    deleteAccount: async () => {
      const {error} = await supabase.rpc('delete_own_account');
      if (!error) await supabase.auth.signOut({scope: 'local'});
      return {error};
    },
  };
}
