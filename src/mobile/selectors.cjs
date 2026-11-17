const {eligible}=require('../data/integrity.cjs');
const defaults={species:'all',city:'all',urgent:false,query:''};
const norm=v=>String(v||'').toLocaleLowerCase('lt').normalize('NFD').replace(/[̀-ͯ]/g,'');
function matchesQuery(p,query) {
 const words=norm(query).trim().split(/\s+/).filter(Boolean);
 if(!words.length) return true;
 const hay=norm([p.name,p.city,p.shelter?.name,p.species==='dog'?'suo sunys dog':p.species==='cat'?'kate kates cat':''].join(' '));
 return words.every(w=>hay.includes(w));
}
function selectPets(pets,filters=defaults) {
 return pets.filter(p=>eligible(p) && (filters.species==='all'||p.species===filters.species) && (filters.city==='all'||p.city===filters.city) && (!filters.urgent || (p.urgent===true && Boolean(p.urgentEvidence))) && matchesQuery(p,filters.query));
}
function activeFilters(filters) {
 return (filters.city!=='all'?1:0)+(filters.urgent?1:0);
}
// Lithuanian plural form: one (1, 21), few (2-9, 22), many (0, 10-20, 30)
function pl(n,one,few,many) {
 const a=n%10,b=n%100;
 if(a===1&&b!==11) return one;
 if(a>=2&&a<=9&&(b<12||b>19)) return few;
 return many;
}
function roster(pets,id) {return pets.filter(p=>p.shelter?.id===id);}
module.exports={defaults,selectPets,roster,activeFilters,norm,pl};
