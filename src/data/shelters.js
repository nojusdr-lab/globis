// Real Lithuanian animal shelters data with verified contacts, cities, and dog/cat counts
import scrapedShelters from './shelters.json';

export const CITIES = [
  { id: 'all', nameLt: 'Visi', nameEn: 'All', count: 1073 },
  { id: 'Kaunas', nameLt: 'Kaunas', nameEn: 'Kaunas', count: 333 },
  { id: 'Vilnius', nameLt: 'Vilnius', nameEn: 'Vilnius', count: 185 },
  { id: 'Alytus', nameLt: 'Alytus', nameEn: 'Alytus', count: 113 },
  { id: 'Klaipėda', nameLt: 'Klaipėda', nameEn: 'Klaipėda', count: 105 },
  { id: 'Mažeikiai', nameLt: 'Mažeikiai', nameEn: 'Mažeikiai', count: 99 },
  { id: 'Šiauliai', nameLt: 'Šiauliai', nameEn: 'Šiauliai', count: 90 },
  { id: 'Utena', nameLt: 'Utena', nameEn: 'Utena', count: 35 },
  { id: 'Visaginas', nameLt: 'Visaginas', nameEn: 'Visaginas', count: 32 },
  { id: 'Panevėžys', nameLt: 'Panevėžys', nameEn: 'Panevėžys', count: 32 },
  { id: 'Kazlų Rūda', nameLt: 'Kazlų Rūda', nameEn: 'Kazlų Rūda', count: 28 },
  { id: 'Marijampolė', nameLt: 'Marijampolė', nameEn: 'Marijampolė', count: 21 },
];

export const SHELTERS = scrapedShelters;
