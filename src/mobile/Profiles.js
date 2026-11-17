import React from 'react';
import {Text,View,Linking,Share,Pressable} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {eligible,phone,email} from '../data/integrity.cjs';
import {Avatar,Button,Photo,Sheet,SourceLink,StatusNote} from './ui';
import {C,styles as s} from './theme';
import {facts,openQuestions} from './facts.cjs';

function Fact({label,value,note}) {
 const known=value!=null&&value!=='';
 return <View style={[s.fact,!known&&s.factUnknown]}>
  <Text style={s.factLabel}>{label}</Text>
  <Text style={known?s.factValue:s.factValueUnknown}>{known?value:'Nenurodyta'}</Text>
  {known&&note?<Text style={{fontSize:12,color:C.okInk,fontWeight:'500'}}>{note}</Text>:null}
 </View>;
}

export function PetProfile({pet,lang,onClose,onSave,onRemove,onContact,onShelter,saved,reduced,onError,contactInline=false}) {
 const t=(lt,en)=>lang==='lt'?lt:en;
 const date=pet.observedAt&&Number.isFinite(Date.parse(pet.observedAt))?new Date(pet.observedAt):null;
 const bio=lang==='lt'?pet.bioLt:pet.bioEn;
 const rows=facts(pet,lang);
 const questions=openQuestions(pet,lang);
 return <Sheet full lang={lang} title={pet.name} reduced={reduced} onClose={onClose} footer={<View style={s.row}>
   <Button style={{flex:1}} icon={saved?'heart':'heart-outline'} selected={saved} label={saved?t('Išsaugota','Saved'):t('Išsaugoti','Save')}
    accessibilityLabel={saved?t('Išsaugota','Saved'):t('Išsaugoti','Save')} disabled={!saved&&!eligible(pet)} onPress={()=>saved?onRemove(pet):onSave(pet)}/>
   {contactInline?null:<Button style={{flex:1}} primary label={t('Susisiekti','Contact')} icon="call-outline" onPress={()=>onContact(pet)}/>}
  </View>}>
  <View style={{borderRadius:22,overflow:'hidden'}}><Photo lang={lang} pet={pet} height={300} gallery/></View>
  <View style={{gap:4}}>
   <Text style={s.heading}>{pet.name}</Text>
   <Text style={s.body}>{[pet.species==='dog'?t('Šuo','Dog'):pet.species==='cat'?t('Katė','Cat'):null,pet.city].filter(Boolean).join(' · ')}</Text>
  </View>
  <StatusNote pet={pet} lang={lang}/>
  {contactInline?<View style={s.section}><Text style={s.sectionTitle}>{t('Susisiekti su prieglauda','Contact shelter')}</Text><ContactBody pet={pet} lang={lang} onError={onError}/></View>:null}
  <View style={s.facts}>{rows.map(r=><Fact key={r.key} label={r.label} value={r.value} note={r.note}/>)}</View>
  <View style={s.section}>
   <Text style={s.sectionTitle}>{t('Aprašymas','Description')}</Text>
   <Text style={s.body}>{bio||t('Prieglauda aprašymo nepateikė.','The shelter did not provide a description.')}</Text>
  </View>
  {questions.length?<View style={s.section}>
   <Text style={s.sectionTitle}>{t('Ko verta paklausti prieglaudos','Worth asking the shelter')}</Text>
   <View style={s.todo}>{questions.map((q,i)=><View key={q} style={[s.todoRow,i===questions.length-1&&{borderBottomWidth:0}]}>
    <Ionicons name="help-circle-outline" size={18} color={C.muted} style={{marginTop:2}}/><Text style={[s.body,{flex:1,fontSize:15,lineHeight:21}]}>{q}</Text>
   </View>)}</View>
  </View>:null}
  {pet.shelter?.name?<View style={s.section}>
   <Text style={s.sectionTitle}>{t('Prieglauda','Shelter')}</Text>
   <Pressable accessibilityRole="button" accessibilityLabel={`${t('Prieglauda','Shelter')}: ${pet.shelter.name}`} onPress={onShelter?()=>onShelter(pet.shelter.id):undefined} disabled={!onShelter} style={({pressed})=>[s.org,pressed&&{opacity:0.8}]}>
    <Avatar name={pet.shelter.name}/>
    <View style={{flex:1,minWidth:0}}><Text style={s.title}>{pet.shelter.name}</Text>{pet.shelter.city?<Text style={s.muted}>{pet.shelter.city}</Text>:null}</View>
    {onShelter?<Ionicons name="chevron-forward" size={18} color={C.muted}/>:null}
   </Pressable>
  </View>:null}
  <View style={s.section}>
   <Text style={s.sectionTitle}>{t('Šaltinis','Source')}</Text>
   <SourceLink lang={lang} url={pet.url} onError={onError}/>
   {date?<Text style={s.muted}>{t('Stebėta','Observed')}: {date.toLocaleString(lang==='lt'?'lt-LT':'en-GB')}</Text>:<Text style={s.muted}>{t('Stebėjimo laikas nežinomas.','Observation time unknown.')}</Text>}
  </View>
  <Button label={t('Dalintis skelbimu','Share listing')} icon="share-outline" onPress={()=>Share.share({message:`${pet.name} — ${pet.url}`}).catch(()=>onError(t('Nepavyko pasidalinti.','Could not share.')))}/>
 </Sheet>;
}

function ContactRow({icon,title,value,onPress,primary}) {
 return <Pressable accessibilityRole="button" accessibilityLabel={value} onPress={onPress}
  style={({pressed})=>[s.org,primary&&{backgroundColor:C.green,borderColor:C.green},pressed&&{opacity:0.85}]}>
  <View style={[s.avatar,{width:42,height:42},primary&&{backgroundColor:'rgba(255,255,255,0.16)'}]}><Ionicons name={icon} size={19} color={primary?C.white:C.green}/></View>
  <View style={{flex:1,minWidth:0}}><Text style={[s.title,{fontSize:16},primary&&{color:C.white}]}>{title}</Text><Text selectable numberOfLines={1} style={[s.muted,primary&&{color:'rgba(255,255,255,0.85)'}]}>{value}</Text></View>
 </Pressable>;
}

function ContactBody({pet,onError,lang}) {
 const shelter=pet.shelter||{};
 const trusted=Boolean(shelter.contactEvidence);
 const tel=trusted?phone(shelter.phone):null,mail=trusted?email(shelter.email):null;
 const t=(lt,en)=>lang==='lt'?lt:en;
 return <View style={{gap:12}}>
  <View style={[s.org,{backgroundColor:C.surface2,borderColor:C.surface2}]}>
   <Avatar name={shelter.name}/>
   <View style={{flex:1,minWidth:0}}><Text style={s.title}>{shelter.name}</Text><Text style={s.muted}>{t('Dėl gyvūno','About')}: {pet.name}</Text></View>
  </View>
  <StatusNote pet={pet} lang={lang}/>
  {shelter.address?<Text selectable style={s.body}>{shelter.address}</Text>:null}
  {tel?<ContactRow primary icon="call-outline" title={t('Skambinti','Call')} value={tel} onPress={()=>Linking.openURL(`tel:${tel}`).catch(()=>onError(t('Nepavyko pradėti skambučio.','Could not start the call.')))}/>:null}
  {mail?<ContactRow primary={!tel} icon="mail-outline" title={t('Rašyti el. laišką','Email')} value={mail} onPress={()=>Linking.openURL(`mailto:${mail}?subject=${encodeURIComponent(`GLOBIS: ${pet.name}`)}`).catch(()=>onError(t('Nepavyko atidaryti pašto.','Could not open email.')))}/>:null}
  {!tel&&!mail?<Text style={s.body}>{t('Patvirtintų telefono ir el. pašto duomenų nėra. Kreipkitės per originalų šaltinį.','Verified phone and email are unavailable. Contact through the original source.')}</Text>:null}
  <SourceLink lang={lang} url={pet.url} onError={onError}/><SourceLink lang={lang} url={shelter.url} label={t('Prieglaudos šaltinis','Shelter source')} onError={onError}/>
  <Text style={s.muted}>{t('Rodomi tik prieglaudos paskelbti kontaktai.','Only contacts published by the shelter are shown.')}</Text>
 </View>;
}

export function ContactSheet({pet,onClose,reduced,onError,lang}) {
 const t=(lt,en)=>lang==='lt'?lt:en;
 return <Sheet lang={lang} title={t('Susisiekti su prieglauda','Contact shelter')} onClose={onClose} reduced={reduced}><ContactBody pet={pet} lang={lang} onError={onError}/></Sheet>;
}
