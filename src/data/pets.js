// Listings joined with their shelter record, so verified contacts live only in shelters.json.
import {useEffect,useState} from 'react';
import allPets from './allPets.json';
import directPets from './directPets.json';
import shelters from './shelters.json';

import { joinListingShelters, mergeDirect } from './integrity.cjs';
import { fromRemote, fetchPublishedRows } from './appPet.cjs';

const build = direct => joinListingShelters(mergeDirect(allPets, direct), shelters);

// Bundled copy: shown first, and kept whenever the server cannot be reached (offline copy).
export const PETS = build(directPets);

const URL = process.env.EXPO_PUBLIC_SUPABASE_URL, KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
// Bound to this app's server; the paging logic lives in appPet.cjs (tested).
export const fetchPublished = (fetchImpl = fetch) => fetchPublishedRows(URL, KEY, fetchImpl);

// Server rows replace the bundled rows of the sources they cover; other sources keep the bundled copy.
export function usePets() {
  const [pets, setPets] = useState(PETS);
  useEffect(() => {
    if (!URL || !KEY) return;
    let live = true;
    // A failed request keeps the bundled copy; there is nothing for the user to retry or fix.
    fetchPublished().then(rows => { if (live && rows.length) setPets(build(fromRemote(rows, shelters, directPets))); }, () => {});
    return () => { live = false; };
  }, []);
  return pets;
}
