import scrapedShelters from './shelters.json';
import { PETS } from './pets';
import { eligible, shelterPets } from './integrity.cjs';

const active = PETS.filter(eligible);
const cities = [...new Set(PETS.map(pet => pet.city).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'lt'));
export const CITIES = [
  { id: 'all', nameLt: 'Visi', nameEn: 'All', count: active.length },
  ...cities.map(city => ({ id: city, nameLt: city, nameEn: city,
    count: active.filter(pet => pet.city === city).length })),
];

export const SHELTERS = scrapedShelters.map(shelter => {
  const roster = shelterPets(PETS, shelter.id);
  const listed = roster.filter(eligible);
  return { ...shelter, rosterCount: roster.length, totalCount: listed.length,
    dogsCount: listed.filter(pet => pet.species === 'dog').length,
    catsCount: listed.filter(pet => pet.species === 'cat').length };
}).sort((a, b) => b.totalCount - a.totalCount);
