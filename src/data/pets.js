// Listings joined with their shelter record, so verified contacts live only in shelters.json.
import allPets from './allPets.json';
import shelters from './shelters.json';

import { joinListingShelters } from './integrity.cjs';

export const PETS = joinListingShelters(allPets, shelters);
