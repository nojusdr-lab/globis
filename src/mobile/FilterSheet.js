import React,{useState} from 'react';
import {View,Text,Switch} from 'react-native';
import {Button,Sheet} from './ui';
import {C,styles as s} from './theme';
import {defaults,selectPets} from './selectors.cjs';
export default function FilterSheet({filters,pets,onApply,onClose,reduced,lang}) {
 const [draft,setDraft]=useState(filters);
 const cities=[...new Set(pets.map(p=>p.city).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'lt'));
 const t=(lt,en)=>lang==='lt'?lt:en;
 return <Sheet title={t('Filtrai','Filters')} reduced={reduced} onClose={onClose} footer={<Button primary label={t(`Rodyti ${selectPets(pets,draft).length} skelbimus`,`Show ${selectPets(pets,draft).length} listings`)} onPress={()=>onApply(draft)}/>}>
 <Button label={t('Išvalyti','Clear')} onPress={()=>setDraft({...defaults})}/>
 <Text style={s.title}>{t('Gyvūno rūšis','Species')}</Text><View style={s.chips}>{[['all',t('Visi','All')],['dog',t('Šunys','Dogs')],['cat',t('Katės','Cats')]].map(([id,label])=><Button key={id} label={label} selected={draft.species===id} onPress={()=>setDraft({...draft,species:id})}/>)}</View>
 <Text style={s.title}>{t('Miestas','City')}</Text><View style={s.chips}>{['all',...cities].map(city=><Button key={city} label={city==='all'?t('Visi miestai','All cities'):city} selected={draft.city===city} onPress={()=>setDraft({...draft,city})}/>)}</View>
 <View style={[s.row,{justifyContent:'space-between'}]}><View style={{flex:1}}><Text style={s.body}>{t('Skubiai ieško namų','Urgent listings')}</Text><Text style={s.muted}>{t('Tik pagal aiškų prieglaudos žymėjimą.','Only explicit shelter evidence.')}</Text></View><Switch accessibilityLabel={t('Skubiai ieško namų','Urgent listings')} value={draft.urgent} onValueChange={urgent=>setDraft({...draft,urgent})} trackColor={{true:C.green,false:C.line}}/></View>
 </Sheet>;
}
