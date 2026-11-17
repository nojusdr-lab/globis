// Listings joined with their shelter record, so verified contacts live only in shelters.json.
import allPets from './allPets.json';
import directPets from './directPets.json';
import shelters from './shelters.json';

import { joinListingShelters, mergeDirect } from './integrity.cjs';

export const PETS = joinListingShelters(mergeDirect(allPets, directPets), shelters);
