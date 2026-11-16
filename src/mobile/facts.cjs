// Pure helpers for the animal profile: which facts are known, and what to ask the shelter.
// Unknown values stay null so the UI can show "Nenurodyta" instead of guessing.
const yesNo=(v,lt)=>v===true?(lt?'Taip':'Yes'):v===false?(lt?'Ne':'No'):null;

function facts(pet,lang='lt') {
 const lt=lang==='lt';
 const m=pet.medical||{};
 return [
  {key:'age',label:lt?'Amžius':'Age',value:(lt?pet.ageLt:pet.ageEn)||null},
  {key:'sex',label:lt?'Lytis':'Sex',value:pet.sex||null},
  {key:'size',label:lt?'Dydis':'Size',value:pet.size||null},
  {key:'vaccinated',label:lt?'Skiepai':'Vaccinated',value:yesNo(m.vaccinated,lt),note:typeof m.vaccinated==='boolean'?(lt?'Pagal skelbimą':'Per listing'):null},
  {key:'neutered',label:lt?'Sterilizuotas':'Neutered',value:yesNo(m.neutered,lt),note:typeof m.neutered==='boolean'?(lt?'Pagal skelbimą':'Per listing'):null},
  {key:'chipped',label:lt?'Ženklintas':'Microchipped',value:yesNo(m.chipped,lt),note:typeof m.chipped==='boolean'?(lt?'Pagal skelbimą':'Per listing'):null},
 ];
}

function openQuestions(pet,lang='lt') {
 const lt=lang==='lt';
 const m=pet.medical||{};
 const q=[];
 if(!(lt?pet.ageLt:pet.ageEn)) q.push(lt?'Kiek gyvūnui metų ir ar tai tikslus amžius?':'How old is the animal, and is that exact?');
 if(!pet.sex) q.push(lt?'Kokia gyvūno lytis?':'What is the animal\'s sex?');
 if(!pet.size) q.push(lt?'Koks gyvūno dydis ir svoris?':'How big and heavy is the animal?');
 if([m.vaccinated,m.neutered,m.chipped].some(v=>typeof v!=='boolean')) q.push(lt?'Ar gyvūnas paskiepytas, sterilizuotas ir paženklintas? Ar yra dokumentai?':'Is the animal vaccinated, neutered and microchipped? Are there documents?');
 if(!(lt?pet.bioLt:pet.bioEn)) q.push(lt?'Kokio gyvūnas būdo, kaip elgiasi su žmonėmis, vaikais ir kitais gyvūnais?':'What is the animal like with people, children and other animals?');
 if(pet.status!=='available') q.push(lt?'Ar gyvūnas vis dar ieško namų?':'Is the animal still looking for a home?');
 q.push(lt?'Kaip vyksta susipažinimas ir kokia įvaikinimo tvarka?':'How do meeting and adoption work?');
 return q;
}

module.exports={facts,openQuestions};
