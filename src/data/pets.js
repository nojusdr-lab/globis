// Listings joined with their shelter record, so verified contacts live only in shelters.json.
import allPets from './allPets.json';
import shelters from './shelters.json';

const byId = new Map(shelters.map(shelter => [shelter.id, shelter]));
export const PETS = allPets.map(pet => ({ ...pet, shelter: byId.get(pet.shelter.id) ?? pet.shelter }));
