// Optional account (email + password). Signed in: saved animals sync both ways with public.saved.
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
    signIn: (email, password) => supabase.auth.signInWithPassword({email, password}),
    // Works in one step when "Confirm email" is off in Supabase (owner setting).
    signUp: (email, password) => supabase.auth.signUp({email, password}),
    // Forgotten password: a 6-digit code by email ({{ .Token }} in the Reset Password template), then a new password.
    sendReset: email => supabase.auth.resetPasswordForEmail(email),
    resetWithCode: async (email, token, password) => {
      const r = await supabase.auth.verifyOtp({email, token, type: 'recovery'});
      return r.error ? r : supabase.auth.updateUser({password});
    },
    signOut: () => supabase.auth.signOut(),
    deleteAccount: async () => {
      const {error} = await supabase.rpc('delete_own_account');
      if (!error) await supabase.auth.signOut({scope: 'local'});
      return {error};
    },
  };
}
