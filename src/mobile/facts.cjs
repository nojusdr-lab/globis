// Pure helpers for the animal profile: which facts are known, and what to ask the shelter.
// Unknown values stay null so the UI can show "Nenurodyta" instead of guessing.
const yesNo=(v,lt)=>v===true?(lt?'Taip':'Yes'):v===false?(lt?'Ne':'No'):null;
// Scrapers store sex and size as codes; older rows may hold page text, which is shown as is.
const WORDS={male:['Patinas','Male'],female:['Patelė','Female'],small:['Mažas','Small'],medium:['Vidutinis','Medium'],large:['Didelis','Large']};
const word=(v,lt)=>v?(WORDS[v]?WORDS[v][lt?0:1]:v):null;
// Shelters write only Lithuanian: in English the Lithuanian text is shown rather than "not stated".
const text=(pet,k,lt)=>(lt?pet[`${k}Lt`]:pet[`${k}En`]||pet[`${k}Lt`])||null;
// A birth date is shown as one ("2018 10 14", "Spėjama gimimo data: 2016-03-24"), not under "Age".
function age(text,lt) {
 if(!text) return {label:lt?'Amžius':'Age',value:null};
 const m=String(text).match(/^(spėjama\s+)?gimimo\s+data(\s*\(spėjama\))?\s*:\s*(.+)$/iu);
 if(m) return {label:lt?'Gimimo data':'Born',value:m[1]||m[2]?`${m[3]} (${lt?'spėjama':'estimated'})`:m[3]};
 if(/^\d{4}([-. ]\d{1,2}){0,2}$/.test(String(text).trim())) return {label:lt?'Gimimo data':'Born',value:String(text).trim()};
 return {label:lt?'Amžius':'Age',value:text};
}

function facts(pet,lang='lt') {
 const lt=lang==='lt';
 const m=pet.medical||{};
 return [
  {key:'age',...age(text(pet,'age',lt),lt)},
  {key:'sex',label:lt?'Lytis':'Sex',value:word(pet.sex,lt)},
  {key:'size',label:lt?'Dydis':'Size',value:word(pet.size,lt)},
  {key:'vaccinated',label:lt?'Skiepai':'Vaccinated',value:yesNo(m.vaccinated,lt),note:typeof m.vaccinated==='boolean'?(lt?'Pagal skelbimą':'Per listing'):null},
  {key:'neutered',label:lt?'Sterilizuotas':'Neutered',value:yesNo(m.neutered,lt),note:typeof m.neutered==='boolean'?(lt?'Pagal skelbimą':'Per listing'):null},
  {key:'chipped',label:lt?'Ženklintas':'Microchipped',value:yesNo(m.chipped,lt),note:typeof m.chipped==='boolean'?(lt?'Pagal skelbimą':'Per listing'):null},
 ];
}

function openQuestions(pet,lang='lt') {
 const lt=lang==='lt';
 const m=pet.medical||{};
 const q=[];
 if(!text(pet,'age',lt)) q.push(lt?'Kiek gyvūnui metų ir ar tai tikslus amžius?':'How old is the animal, and is that exact?');
 if(!pet.sex) q.push(lt?'Kokia gyvūno lytis?':'What is the animal\'s sex?');
 if(!pet.size) q.push(lt?'Koks gyvūno dydis ir svoris?':'How big and heavy is the animal?');
 if([m.vaccinated,m.neutered,m.chipped].some(v=>typeof v!=='boolean')) q.push(lt?'Ar gyvūnas paskiepytas, sterilizuotas ir paženklintas? Ar yra dokumentai?':'Is the animal vaccinated, neutered and microchipped? Are there documents?');
 if(!text(pet,'bio',lt)) q.push(lt?'Kokio gyvūnas būdo, kaip elgiasi su žmonėmis, vaikais ir kitais gyvūnais?':'What is the animal like with people, children and other animals?');
 if(pet.status!=='available') q.push(lt?'Ar gyvūnas vis dar ieško namų?':'Is the animal still looking for a home?');
 q.push(lt?'Kaip vyksta susipažinimas ir kokia įvaikinimo tvarka?':'How do meeting and adoption work?');
 return q;
}

module.exports={facts,openQuestions,text};
