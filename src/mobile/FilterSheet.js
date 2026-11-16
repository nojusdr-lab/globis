import React,{useState} from 'react';
import {View,Text,Switch} from 'react-native';
import {Button,Chip,Sheet} from './ui';
import {C,styles as s} from './theme';
import {defaults,selectPets,pl} from './selectors.cjs';

export default function FilterSheet({filters,pets,onApply,onClose,reduced,lang}) {
 const [draft,setDraft]=useState(filters);
 const cities=[...new Set(pets.map(p=>p.city).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'lt'));
 const t=(lt,en)=>lang==='lt'?lt:en;
 const n=selectPets(pets,draft).length;
 const cityCount=city=>selectPets(pets,{...draft,city}).length;
 return <Sheet title={t('Filtrai','Filters')} reduced={reduced} onClose={onClose} footer={<View style={s.row}>
   <Button label={t('Išvalyti','Clear')} onPress={()=>setDraft({...defaults,query:draft.query})}/>
   <Button style={{flex:1}} primary label={t(`Rodyti ${n} ${pl(n,'skelbimą','skelbimus','skelbimų')}`,`Show ${n} ${n===1?'listing':'listings'}`)} onPress={()=>onApply(draft)}/>
  </View>}>
  <View style={{gap:10}}>
   <Text style={s.sectionTitle}>{t('Gyvūno rūšis','Species')}</Text>
   <View style={s.chips}>{[['all',t('Visi','All')],['dog',t('Šunys','Dogs')],['cat',t('Katės','Cats')]].map(([id,label])=><Chip key={id} label={label} selected={draft.species===id} onPress={()=>setDraft({...draft,species:id})}/>)}</View>
  </View>
  <View style={{gap:10}}>
   <Text style={s.sectionTitle}>{t('Miestas','City')}</Text>
   <View style={s.chips}>{['all',...cities].map(city=><Chip key={city} label={city==='all'?t('Visi miestai','All cities'):city} count={city==='all'?null:cityCount(city)} selected={draft.city===city} onPress={()=>setDraft({...draft,city})}/>)}</View>
  </View>
  <View style={[s.row,{justifyContent:'space-between'}]}>
   <View style={{flex:1}}><Text style={s.body}>{t('Skubiai ieško namų','Urgent listings')}</Text><Text style={s.muted}>{t('Tik pagal aiškų prieglaudos žymėjimą.','Only explicit shelter evidence.')}</Text></View>
   <Switch style={{minHeight:48,minWidth:48}} accessibilityLabel={t('Skubiai ieško namų','Urgent listings')} value={draft.urgent} onValueChange={urgent=>setDraft({...draft,urgent})} trackColor={{true:C.green,false:C.line2}}/>
  </View>
  <View style={[s.note,{backgroundColor:C.surface2}]}>
   <Text style={[s.muted,{flex:1}]}>{t('Amžiaus, lyties ir dydžio filtrų nėra, nes prieglaudų skelbimuose šių duomenų dabar nėra. Neapsimetame, kad juos žinome.','There are no age, sex or size filters because shelter listings do not include this data yet. We do not pretend to know it.')}</Text>
  </View>
 </Sheet>;
}
