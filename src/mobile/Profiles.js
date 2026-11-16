import React from 'react';
import {Text,View,Linking,Share} from 'react-native';
import {eligible,phone,email} from '../data/integrity.cjs';
import {Button,Photo,Sheet,SourceLink,Status} from './ui';
import {styles as s} from './theme';
export function PetProfile({pet,lang,onClose,onSave,onContact,saved,reduced,onError}) {
 const t=(lt,en)=>lang==='lt'?lt:en;
 const known=[lang==='lt'?pet.ageLt:pet.ageEn,pet.sex,pet.size,pet.city].filter(Boolean);
 const date=pet.observedAt&&Number.isFinite(Date.parse(pet.observedAt))?new Date(pet.observedAt):null;
 return <Sheet full title={pet.name} reduced={reduced} onClose={onClose} footer={<View style={s.row}><Button style={{flex:1}} primary icon="heart-outline" label={saved?t('Išsaugota','Saved'):t('Išsaugoti','Save')} disabled={saved||!eligible(pet)} onPress={()=>onSave(pet)}/><Button style={{flex:1}} label={t('Susisiekti','Contact')} icon="chatbubble-outline" onPress={()=>onContact(pet)}/></View>}>
 <Photo lang={lang} pet={pet} height={320} gallery/><Status pet={pet} lang={lang}/><Text style={s.heading}>{pet.name}</Text>{known.length?<Text style={s.body}>{known.join(' · ')}</Text>:null}
 <Text style={s.body}>{pet.shelter?.name}</Text>{(lang==='lt'?pet.bioLt:pet.bioEn)?<Text style={s.body}>{lang==='lt'?pet.bioLt:pet.bioEn}</Text>:null}
 {Object.entries(pet.medical||{}).filter(([,value])=>typeof value==='boolean').map(([key,value])=><Text key={key} style={s.body}>{({chipped:t('Ženklintas','Microchipped'),vaccinated:t('Skiepytas','Vaccinated'),neutered:t('Sterilizuotas','Neutered')})[key]||key}: {value?t('Taip','Yes'):t('Ne','No')}</Text>)}
 <SourceLink url={pet.url} onError={onError}/>{date?<Text style={s.muted}>{t('Stebėta','Observed')}: {date.toLocaleString(lang==='lt'?'lt-LT':'en-GB')}</Text>:<Text style={s.muted}>{t('Stebėjimo laikas nežinomas.','Observation time unknown.')}</Text>}
 <Button label={t('Dalintis skelbimu','Share listing')} icon="share-outline" onPress={()=>Share.share({message:`${pet.name} — ${pet.url}`}).catch(()=>onError('Nepavyko pasidalinti.'))}/>
 </Sheet>;
}
export function ContactSheet({pet,onClose,reduced,onError,lang}) {
 const shelter=pet.shelter||{};
 const trusted=Boolean(shelter.contactEvidence);
 const tel=trusted?phone(shelter.phone):null,mail=trusted?email(shelter.email):null;
 const t=(lt,en)=>lang==='lt'?lt:en;
 return <Sheet title={t('Susisiekti su prieglauda','Contact shelter')} onClose={onClose} reduced={reduced}>
 <Text style={s.title}>{shelter.name}</Text><Status pet={pet} lang={lang}/><Text style={s.body}>{t('Dėl gyvūno','About')}: {pet.name}</Text>{shelter.address?<Text selectable style={s.body}>{shelter.address}</Text>:null}
 {tel?<Button label={tel} icon="call-outline" onPress={()=>Linking.openURL(`tel:${tel}`).catch(()=>onError('Nepavyko pradėti skambučio.'))}/>:null}
 {mail?<Button label={mail} icon="mail-outline" onPress={()=>Linking.openURL(`mailto:${mail}?subject=${encodeURIComponent(`GLOBIS: ${pet.name}`)}`).catch(()=>onError('Nepavyko atidaryti pašto.'))}/>:null}
 {!tel&&!mail?<Text style={s.body}>{t('Patvirtintų telefono ir el. pašto duomenų nėra. Kreipkitės per originalų šaltinį.','Verified phone and email are unavailable. Contact through the original source.')}</Text>:null}
 <SourceLink url={pet.url} onError={onError}/><SourceLink url={shelter.url} label={t('Prieglaudos šaltinis','Shelter source')} onError={onError}/>
 </Sheet>;
}
