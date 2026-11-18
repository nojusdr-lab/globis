import React,{useEffect,useMemo,useRef,useState} from 'react';
import {View,Text,Pressable,ScrollView,Animated,useWindowDimensions} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {Ionicons} from '@expo/vector-icons';
import {Image} from 'expo-image';
import {Button,Chip} from './ui';
import {C,styles as s} from './theme';
import {pl} from './selectors.cjs';

// Four steps: mission, how to swipe, species, city. Every number shown is counted from the real data.
export default function Onboarding({lang,reduced,pets,shelters,onLang,onDone}) {
 const t=(lt,en)=>lang==='lt'?lt:en;
 const [step,setStep]=useState(0),[species,setSpecies]=useState('all'),[city,setCity]=useState('all');
 const {width}=useWindowDimensions();
 const faces=useMemo(()=>pets.filter(p=>p.photos?.length).slice(0,3),[pets]);
 const cities=useMemo(()=>{const c={};pets.filter(p=>species==='all'||p.species===species).forEach(p=>{if(p.city)c[p.city]=(c[p.city]||0)+1;});return Object.entries(c).sort((a,b)=>b[1]-a[1]);},[pets,species]);
 const x=useRef(new Animated.Value(0)).current;
 useEffect(()=>{
  if(step!==1||reduced) return;
  const loop=Animated.loop(Animated.sequence([
   Animated.timing(x,{toValue:60,duration:700,useNativeDriver:true}),Animated.timing(x,{toValue:0,duration:500,useNativeDriver:true}),
   Animated.timing(x,{toValue:-60,duration:700,useNativeDriver:true}),Animated.timing(x,{toValue:0,duration:500,useNativeDriver:true})]));
  loop.start();return ()=>loop.stop();
 },[step,reduced,x]);
 const finish=()=>onDone({species,city});
 const next=()=>step<3?setStep(step+1):finish();
 const photo=Math.min(width-48,320);

 const screens=[
  <View key="mission" style={{alignItems:'center',gap:18}}>
   <View style={{flexDirection:'row',justifyContent:'center'}}>
    {faces.map((p,i)=><Image key={p.id} source={{uri:p.photos[0]}} cachePolicy="memory-disk" contentFit="cover" accessibilityLabel={p.name}
     style={{width:photo/2.4,height:photo/2.4,borderRadius:photo/4.8,marginLeft:i?-18:0,borderWidth:4,borderColor:C.bg}}/>)}
   </View>
   <Text accessibilityRole="header" style={[s.heading,{textAlign:'center',fontSize:30,lineHeight:36}]}>{t('Jie laukia ne bet ko.\nJie laukia tavęs.','They are not waiting for anyone.\nThey are waiting for you.')}</Text>
   <Text style={[s.body,{textAlign:'center',maxWidth:340}]}>{t(`Šiuo metu ${pets.length} ${pl(pets.length,'gyvūnas','gyvūnai','gyvūnų')} iš ${shelters} ${pl(shelters,'prieglaudos','prieglaudų','prieglaudų')} ieško namų. Kiekvienas jų turi vardą, istoriją ir viltį.`,`Right now ${pets.length} animals from ${shelters} shelters are looking for a home. Each has a name, a story and hope.`)}</Text>
   <Text style={[s.body,{textAlign:'center',maxWidth:340,fontWeight:'600',color:C.green}]}>{t('GLOBIS surenka juos į vieną vietą, kad rastum savąjį.','GLOBIS brings them into one place so you can find yours.')}</Text>
  </View>,
  <View key="swipe" style={{alignItems:'center',gap:18}}>
   <Animated.View style={[s.card,{width:photo*0.8,transform:[{translateX:x},{rotate:x.interpolate({inputRange:[-60,0,60],outputRange:['-8deg','0deg','8deg']})}]}]}>
    {faces[0]?<Image source={{uri:faces[0].photos[0]}} cachePolicy="memory-disk" contentFit="cover" style={{width:'100%',height:photo*0.8}} accessibilityElementsHidden/>:<View style={{height:photo*0.8}}/>}
   </Animated.View>
   <Text accessibilityRole="header" style={[s.heading,{textAlign:'center'}]}>{t('Perbrauk ir išsaugok','Swipe to save')}</Text>
   <View style={[s.row,{gap:24}]}>
    <View style={{alignItems:'center',gap:4}}><Ionicons name="arrow-back" size={22} color={C.ink2}/><Text style={s.body}>{t('Praleisti','Pass')}</Text></View>
    <View style={{alignItems:'center',gap:4}}><Ionicons name="arrow-forward" size={22} color={C.green}/><Text style={[s.body,{color:C.green,fontWeight:'600'}]}>{t('Išsaugoti','Save')}</Text></View>
   </View>
   <Text style={[s.muted,{textAlign:'center',maxWidth:320}]}>{t('Išsaugotus gyvūnus rasi skiltyje „Išsaugoti“ ir galėsi susisiekti su prieglauda.','Saved animals wait in the Saved tab, where you can contact the shelter.')}</Text>
  </View>,
  <View key="species" style={{gap:14,alignSelf:'stretch'}}>
   <Text accessibilityRole="header" style={[s.heading,{textAlign:'center'}]}>{t('Ką norėtum priglausti?','Who would you like to adopt?')}</Text>
   {[['dog','🐕',t('Šunį','A dog')],['cat','🐈',t('Katę','A cat')],['all','🐾',t('Nesvarbu','Either')]].map(([id,icon,label])=><Pressable key={id} accessibilityRole="radio" accessibilityLabel={label} accessibilityState={{checked:species===id}} onPress={()=>setSpecies(id)} style={({pressed})=>[s.listCard,species===id&&{borderColor:C.green,borderWidth:2},pressed&&{opacity:0.85}]}>
    <Text style={{fontSize:28}} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">{icon}</Text>
    <Text style={[s.title,{flex:1}]}>{label}</Text>
    {species===id?<Ionicons name="checkmark-circle" size={22} color={C.green}/>:null}
   </Pressable>)}
  </View>,
  <View key="city" style={{gap:14,alignSelf:'stretch'}}>
   <Text accessibilityRole="header" style={[s.heading,{textAlign:'center'}]}>{t('Kur ieškai?','Where are you looking?')}</Text>
   <View style={[s.chips,{justifyContent:'center'}]}>
    {[['all',null],...cities].map(([c,n])=><Chip key={c} label={c==='all'?t('Visa Lietuva','All of Lithuania'):c} count={n} selected={city===c} onPress={()=>setCity(c)}/>)}
   </View>
  </View>,
 ];

 return <SafeAreaView style={s.root} edges={['top','bottom']}>
  <View style={[s.row,{justifyContent:'space-between',paddingHorizontal:16,paddingTop:8}]}>
   <View style={s.row}>{[['lt','🇱🇹'],['en','🇬🇧']].map(([id,flag])=><Pressable key={id} accessibilityRole="button" accessibilityLabel={id==='lt'?'Lietuvių':'English'} accessibilityState={{selected:lang===id}} onPress={()=>onLang(id)} style={{padding:8,opacity:lang===id?1:0.45}}><Text style={{fontSize:22}}>{flag}</Text></Pressable>)}</View>
   <Pressable accessibilityRole="button" onPress={finish} style={{padding:12}}><Text style={[s.body,{color:C.muted}]}>{t('Praleisti','Skip')}</Text></Pressable>
  </View>
  <ScrollView contentContainerStyle={{flexGrow:1,justifyContent:'center',alignItems:'center',padding:24,width:'100%',maxWidth:520,alignSelf:'center'}}>{screens[step]}</ScrollView>
  <View style={{padding:16,gap:14,width:'100%',maxWidth:520,alignSelf:'center'}}>
   <View style={[s.row,{justifyContent:'center',gap:6}]} accessibilityLabel={t(`${step+1} žingsnis iš 4`,`Step ${step+1} of 4`)}>
    {[0,1,2,3].map(i=><View key={i} style={{width:i===step?22:8,height:8,borderRadius:4,backgroundColor:i===step?C.green:C.line||'#d5ddd9'}}/>)}
   </View>
   <Button primary label={[t('Susipažinti','Meet them'),t('Supratau','Got it'),t('Toliau','Next'),t('Rodyti gyvūnus','Show animals')][step]} onPress={next}/>
  </View>
 </SafeAreaView>;
}
