const {eligible}=require('../data/integrity.cjs');
const defaults={species:'all',city:'all',urgent:false};
function selectPets(pets,filters=defaults) {
 return pets.filter(p=>eligible(p) && (filters.species==='all'||p.species===filters.species) && (filters.city==='all'||p.city===filters.city) && (!filters.urgent || (p.urgent===true && Boolean(p.urgentEvidence))));
}
function roster(pets,id) {return pets.filter(p=>p.shelter?.id===id);}
module.exports={defaults,selectPets,roster};
