import React,{useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {View,Text,Image,Pressable,ScrollView,FlatList,TextInput,useWindowDimensions,StatusBar} from 'react-native';
import {SafeAreaProvider,SafeAreaView} from 'react-native-safe-area-context';
import {GestureDetector,GestureHandlerRootView,usePanGesture} from 'react-native-gesture-handler';
import Reanimated,{Easing,Extrapolation,interpolate,useAnimatedStyle,useSharedValue,withSpring,withTiming} from 'react-native-reanimated';
import {scheduleOnRN} from 'react-native-worklets';
import {Image as CachedImage} from 'expo-image';
import {Ionicons} from '@expo/vector-icons';
import {LinearGradient} from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import {useFonts,Fraunces_600SemiBold} from '@expo-google-fonts/fraunces';
import useDiscovery from '../state/useDiscovery';
import useReducedMotion from '../state/useReducedMotion';
import {cardAge} from './facts.cjs';
import {eligible} from '../data/integrity.cjs';
import {usePets} from '../data/pets';
import organizations from '../data/shelters.json';
import {defaults,selectPets,roster,activeFilters,pl} from './selectors.cjs';
import {C,styles as s} from './theme';
import {Avatar,Button,Directions,Empty,HeartButton,Photo,Sheet,SourceLink,Status} from './ui';
import FilterSheet from './FilterSheet';
import Onboarding from './Onboarding';
import {expo as config} from '../../app.json';
import AboutSheet from './AboutSheet';
import AccountSection from './AccountSection';
import useAccount from '../state/useAccount';
import {PetProfile,ContactSheet} from './Profiles';

const THRESHOLD=80;

// A saved animal the shelter no longer lists: shown from its last seen card. Not a claim that it was adopted.
const ghost=(id,snap)=>snap?{id,name:snap.name,photos:snap.photo?[snap.photo]:[],city:snap.city??null,species:snap.species??null,url:snap.url??null,
 status:'no_longer_listed',medical:{},shelter:snap.shelter?{name:snap.shelter}:null}:null;

// Reanimated + gesture-handler: the drag, snap-back and fly-out run on the UI thread, so a busy JS thread cannot make the card lag.
const EASE_OUT=Easing.bezier(0.23,1,0.32,1);
function SwipeSurface({pet,onSave,onPass,reduced,saveLabel,passLabel,children}) {
 const x=useSharedValue(0);
 const callbacks=useRef({});callbacks.current={pet,onSave,onPass};
 const commit=useCallback(right=>{const c=callbacks.current;(right?c.onSave:c.onPass)(c.pet);},[]);
 const pan=usePanGesture({
  // Horizontal only: vertical drags and taps stay with the photo and the profile button.
  activeOffsetX:[-12,12],failOffsetY:[-14,14],
  onUpdate:e=>{'worklet';if(!reduced)x.set(e.translationX);},
  onDeactivate:e=>{'worklet';
   const dx=e.translationX,fling=Math.abs(e.velocityX)>800&&Math.sign(e.velocityX)===Math.sign(dx);
   if(Math.abs(dx)<=THRESHOLD&&!fling){x.set(withSpring(0,{duration:400,dampingRatio:0.8,velocity:e.velocityX}));return;}
   const right=dx>0;
   if(reduced){scheduleOnRN(commit,right);return;}
   // No reset to 0 here: the card is keyed by pet id, so the next one mounts centred. Resetting first flashed the old card back (the "teleport").
   x.set(withTiming(right?640:-640,{duration:180,easing:EASE_OUT},done=>{if(done)scheduleOnRN(commit,right);}));
  },
 });
 const card=useAnimatedStyle(()=>({transform:[{translateX:x.get()},{rotate:`${interpolate(x.get(),[-300,0,300],[-14,0,14])}deg`}]}));
 const saveStamp=useAnimatedStyle(()=>({opacity:interpolate(x.get(),[0,THRESHOLD],[0,1],Extrapolation.CLAMP)}));
 const passStamp=useAnimatedStyle(()=>({opacity:interpolate(x.get(),[-THRESHOLD,0],[1,0],Extrapolation.CLAMP)}));
 return <GestureDetector gesture={pan}><Reanimated.View style={[{flex:1},card]}>
  {children}
  <Reanimated.View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[s.stamp,{left:16,borderColor:C.warm,transform:[{rotate:'-8deg'}]},saveStamp]}><Text style={[s.stampText,{color:C.warm}]}>{saveLabel}</Text></Reanimated.View>
  <Reanimated.View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[s.stamp,{right:16,borderColor:C.ink2,transform:[{rotate:'8deg'}]},passStamp]}><Text style={[s.stampText,{color:C.ink2}]}>{passLabel}</Text></Reanimated.View>
 </Reanimated.View></GestureDetector>;
}

function AppContent() {
 const {state,dispatch,error,retry}=useDiscovery(), reduced=useReducedMotion();
 const PETS=usePets();
 const account=useAccount(state.saved,dispatch);
 const [about,setAbout]=useState(false),[tab,setTab]=useState('discover'),[filters,setFilters]=useState(()=>({...defaults,...state.filters})),[filterOpen,setFilterOpen]=useState(false),[profile,setProfile]=useState(null),[contact,setContact]=useState(null),[shelterId,setShelterId]=useState(null),[search,setSearch]=useState(''),[toast,setToast]=useState(null);
 const timer=useRef(null);
 const {height,width}=useWindowDimensions();
 const lang=state.lang,t=(lt,en)=>lang==='lt'?lt:en;
 const filtered=useMemo(()=>selectPets(PETS,filters),[PETS,filters]);
 const pending=useMemo(()=>filtered.filter(p=>!state.saved.includes(p.id)&&!state.passed.includes(p.id)),[filtered,state.saved,state.passed]);
 const saved=useMemo(()=>state.saved.map(id=>PETS.find(p=>p.id===id)||ghost(id,state.snaps?.[id])).filter(Boolean),[PETS,state.saved,state.snaps]);
 const notify=value=>{clearTimeout(timer.current);setToast(typeof value==='string'?{text:value}:value);timer.current=setTimeout(()=>setToast(null),5000);};
 const isSaved=id=>state.saved.includes(id);
 const save=pet=>{if(!eligible(pet))return;Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(()=>{});dispatch({type:'save',id:pet.id,snap:{name:pet.name,photo:pet.photos?.[0],city:pet.city,shelter:pet.shelter?.name,url:pet.url,species:pet.species}});notify({text:t(`Išsaugota: ${pet.name}`,`Saved: ${pet.name}`),action:t('Atšaukti','Undo'),actionLabel:t('Atšaukti išsaugojimą','Undo save'),run:()=>dispatch({type:'undo'})});};
 const remove=pet=>{dispatch({type:'remove',id:pet.id});notify({text:t(`Pašalinta: ${pet.name}`,`Removed: ${pet.name}`),action:t('Grąžinti','Restore'),run:()=>dispatch({type:'save',id:pet.id})});};
 const pass=pet=>{dispatch({type:'pass',id:pet.id});};
 const columns=width>900?4:width>600?3:2;
 const nf=activeFilters(filters);
 const resetAll=()=>{setFilters({...defaults});dispatch({type:'resetPassed'});};

 const petItem=(pet,inSaved=false)=><View style={[s.gcard,{maxWidth:`${100/columns}%`}]}>
  <View style={s.gphoto}>
   <Pressable accessibilityRole="button" accessibilityLabel={`${t('Atidaryti profilį','Open profile')}: ${pet.name}`} onPress={()=>setProfile(pet)}>
    <Photo lang={lang} pet={pet} height={Math.round(Math.min(260,Math.max(150,(width-24)/columns*1.15)))}>
     {['reserved','no_longer_listed'].includes(pet.status)?<View style={[s.onPhoto,{left:8,bottom:8}]}><Status pet={pet} lang={lang} small/></View>:null}
    </Photo>
   </Pressable>
   <HeartButton saved={isSaved(pet.id)} name={pet.name} lang={lang} disabled={!isSaved(pet.id)&&!eligible(pet)} onPress={()=>isSaved(pet.id)?remove(pet):save(pet)}/>
  </View>
  <Pressable accessibilityElementsHidden importantForAccessibility="no-hide-descendants" onPress={()=>setProfile(pet)} style={{paddingHorizontal:2}}>
   <Text style={s.gname} numberOfLines={2}>{pet.name}</Text>
   <Text style={s.muted} numberOfLines={1}>{[pet.city,pet.shelter?.name].filter(Boolean).join(' · ')}</Text>
  </Pressable>
  {inSaved?<Button label={t('Susisiekti','Contact')} icon="call-outline" onPress={()=>setContact(pet)} style={{minHeight:44,alignSelf:'flex-start'}}/>:null}
 </View>;

 const noMatches=<Empty icon="search-outline" title={t('Nepavyko rasti augintinių','No pets found')}
  body={t('Pakeiskite paiešką ar filtrus arba grįžkite vėliau.','Change the search or filters, or come back later.')}
  action={t('Atstatyti filtrus','Reset filters')} onAction={resetAll}/>;
 const list=(pets,inSaved=false)=><FlatList keyboardShouldPersistTaps="handled" key={`${tab}-${columns}`} data={pets} numColumns={columns} keyExtractor={p=>p.id}
  contentContainerStyle={{paddingHorizontal:10,paddingBottom:24}} renderItem={({item})=>petItem(item,inSaved)} ListEmptyComponent={noMatches}
  initialNumToRender={8} windowSize={7} removeClippedSubviews/>;

 const shelters=useMemo(()=>organizations.map(org=>{const pets=roster(PETS,org.id),active=pets.filter(eligible);return {...org,pets,active:active.length,matching:active.filter(p=>filters.species==='all'||p.species===filters.species).length};}).filter(org=>[org.name,org.city].join(' ').toLocaleLowerCase('lt').includes(search.toLocaleLowerCase('lt'))&&(filters.species==='all'||org.matching>0)&&(filters.city==='all'||org.city===filters.city)).sort((a,b)=>b.active-a.active),[PETS,search,filters]);
 const shelter=shelterId?(()=>{const org=organizations.find(o=>o.id===shelterId);if(!org)return null;const pets=roster(PETS,org.id);return {...org,pets,active:pets.filter(eligible).length};})():null;

 const top=pending[0];
 useEffect(()=>{dispatch({type:'filters',filters});},[filters]);
 // Warm the disk cache for the next cards so a swipe shows the photo at once.
 useEffect(()=>{const next=pending.slice(1,4).map(p=>p.photos?.[0]).filter(Boolean);if(next.length)CachedImage.prefetch(next,'memory-disk').catch(()=>{});},[pending]);
 // Photo takes exactly the height left on screen (measured), so the page never scrolls.
 const [photoH,setPhotoH]=useState(0);

 if(!state.onboarded) return <Onboarding lang={lang} reduced={reduced} pets={PETS.filter(eligible)} shelters={organizations.length} onLang={l=>dispatch({type:'language',lang:l})} onDone={f=>{setFilters({...defaults,...f});dispatch({type:'onboarded',filters:{...defaults,...f}});}}/>;
 return <SafeAreaView style={s.root} edges={['top','bottom']}><StatusBar barStyle="dark-content" backgroundColor={C.bg}/><View style={s.shell}>
  <View style={s.header}>
   <Pressable accessibilityRole="button" accessibilityLabel={t('Apie GLOBIS','About GLOBIS')} onPress={()=>setAbout(true)} style={{minHeight:48,justifyContent:'center'}}>
    <Image source={require('../../Code_Generated_Image.png')} accessibilityLabel="GLOBIS" style={[s.logo,width<360&&{width:100}]} resizeMode="contain"/>
   </Pressable>
   {tab==='discover'?<>
    <Pressable accessibilityRole="button" accessibilityLabel={t('Filtrai','Filters')} accessibilityHint={nf?t(`Aktyvūs filtrai: ${nf}`,`Active filters: ${nf}`):undefined} onPress={()=>setFilterOpen(true)} style={({pressed})=>[s.filterBtn,nf&&s.filterBtnOn,pressed&&{opacity:0.8}]}>
     <Ionicons name="options-outline" size={21} color={nf?C.white:C.ink}/>
     {nf?<View style={s.countBadge}><Text style={s.countBadgeText}>{nf}</Text></View>:null}
    </Pressable>
   </>:null}
  </View>

  {error?<View style={s.banner}><Text accessibilityRole="alert" style={[s.body,{color:C.warnInk}]}>{{read:t('Nepavyko perskaityti pasirinkimų. Esami duomenys neperrašyti.','Could not read your saved choices. Existing data was not overwritten.'),write:t('Nepavyko išsaugoti pasirinkimų šiame įrenginyje.','Could not save your choices on this device.'),retry:t('Vietinė saugykla vis dar nepasiekiama arba duomenys netinkami. Esami duomenys neperrašyti.','Local storage is still unavailable or the data is invalid. Existing data was not overwritten.')}[error]||error}</Text><Button label={t('Bandykite dar kartą','Retry')} onPress={retry} style={{alignSelf:'flex-start'}}/></View>:null}

  {tab==='discover'?<>

   {top?<View style={{flex:1,paddingHorizontal:16,paddingBottom:8,width:'100%',maxWidth:480,alignSelf:'center'}}>
     {/* The next card waits underneath, so dragging the top one reveals it. */}
     <View style={{flex:1,marginBottom:8}}>
     {pending[1]&&photoH?<View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[s.card,{position:'absolute',left:0,right:0,top:0,bottom:0}]}>
      <Photo lang={lang} pet={pending[1]} height={photoH}>
       <LinearGradient colors={['rgba(12,24,19,0)','rgba(12,24,19,0.88)']} style={s.cardShade}/>
       <View style={s.cardOverlay}><Text style={s.cardNameLight} numberOfLines={2}>{pending[1].name}</Text></View>
      </Photo>
     </View>:null}
     <SwipeSurface key={top.id} pet={top} onSave={save} onPass={pass} reduced={reduced} saveLabel={t('IŠSAUGOTI','SAVE')} passLabel={t('PRALEISTI','PASS')}>
      <View style={[s.card,{flex:1}]}>
       <View style={{flex:1}} onLayout={e=>setPhotoH(Math.round(e.nativeEvent.layout.height))}>
       {photoH?<Photo lang={lang} pet={top} height={photoH} tapToBrowse>
        {['available','reserved'].includes(top.status)?<View style={[s.onPhoto,{top:20,left:12}]}><Status pet={top} lang={lang} small/></View>:null}
        <View style={[s.onPhoto,{top:20,right:12}]}><View style={s.countChip}><Text style={s.countChipText} accessibilityLabel={t(`Liko peržiūrėti: ${pending.length}`,`Left to review: ${pending.length}`)}>{t(`${pending.length.toLocaleString('lt')} laukia`,`${pending.length.toLocaleString('en')} waiting`)}</Text></View></View>
        <LinearGradient pointerEvents="none" colors={['rgba(12,24,19,0)','rgba(12,24,19,0.88)']} style={s.cardShade}/>
        <Pressable accessibilityRole="button" accessibilityLabel={`${t('Atidaryti profilį','Open profile')}: ${top.name}`} onPress={()=>setProfile(top)} style={({pressed})=>[s.cardOverlay,pressed&&{opacity:0.85}]}>
         <View style={[s.row,{alignItems:'baseline',gap:10}]}>
          <Text style={[s.cardNameLight,{flex:1}]} numberOfLines={2}>{top.name}</Text>
          <View style={s.cardMore}><Ionicons name="chevron-forward" size={18} color={C.white}/></View>
         </View>
         <View style={[s.row,{gap:6}]}><Ionicons name="location-outline" size={15} color="rgba(255,255,255,0.85)"/><Text style={[s.cardMetaLight,{flex:1}]} numberOfLines={1}>{[top.city||t('Miestas nenurodytas','City not listed'),top.shelter?.name].filter(Boolean).join(' · ')}</Text></View>
         {cardAge(top,lang)?<Text style={s.cardMetaLight} numberOfLines={1}>{cardAge(top,lang)}</Text>:null}
         {!['available','reserved'].includes(top.status)?<View style={[s.row,{gap:6}]}><Ionicons name="help-circle-outline" size={15} color="rgba(255,255,255,0.75)"/><Text style={[s.cardMetaLight,{flex:1,fontSize:13,opacity:0.85}]} numberOfLines={1}>{t('Ar dar ieško namų, pasitikslink prieglaudoje','Check with the shelter that it is still available')}</Text></View>:null}
        </Pressable>
       </Photo>:null}
       </View>
      </View>
     </SwipeSurface>
     </View>
     <View style={s.actions}>
      <Pressable accessibilityRole="button" accessibilityLabel={t('Atšaukti','Undo')} accessibilityState={{disabled:!state.history.length}} disabled={!state.history.length} onPress={()=>dispatch({type:'undo'})} style={({pressed})=>[s.act,s.actSmall,!state.history.length&&s.disabled,pressed&&{transform:[{scale:0.95}]}]}><Ionicons name="arrow-undo-outline" size={20} color={C.ink2}/></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={t('Praleisti','Pass')} onPress={()=>pass(top)} style={({pressed})=>[s.act,s.actRound,pressed&&{transform:[{scale:0.95}]}]}><Ionicons name="close" size={26} color={C.ink2}/></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={t('Išsaugoti','Save')} onPress={()=>save(top)} style={({pressed})=>[s.act,s.actSave,pressed&&{transform:[{scale:0.97}]}]}><Ionicons name="heart-outline" size={21} color={C.white}/><Text style={s.actSaveText}>{t('Išsaugoti','Save')}</Text></Pressable>
     </View>
     <Text style={s.hint}>{t('Perbraukite dešinėn, kad išsaugotumėte, kairėn, kad praleistumėte','Swipe right to save, left to pass')}</Text>
    </View>
   :filtered.length?<Empty icon="checkmark-done-outline" title={t('Peržiūrėjote visus skelbimus','You have seen every listing')}
     body={t('Išsaugotus gyvūnus rasite skiltyje „Išsaugoti“.','Saved animals are in the Saved tab.')}
     action={state.history.length?t('Atšaukti','Undo'):t('Peržiūrėti praleistus','Review passed')} onAction={()=>state.history.length?dispatch({type:'undo'}):dispatch({type:'resetPassed'})}/>
   :noMatches}
  </>:null}

  {tab==='saved'?<>
   <View style={[s.toolbar,{paddingTop:4}]}><View style={{flex:1}}><Text accessibilityRole="header" style={s.heading}>{t('Išsaugoti','Saved')}</Text><Text style={s.muted}>{saved.length?t(`${saved.length} ${pl(saved.length,'gyvūnas','gyvūnai','gyvūnų')} · ${account.email?'sinchronizuojama su paskyra':'laikoma šiame įrenginyje'}`,`${saved.length} ${saved.length===1?'animal':'animals'} · ${account.email?'synced to your account':'stored on this device'}`):t('Paskyros nereikia','No account needed')}</Text></View></View>
   {saved.length?list(saved,true):<Empty icon="heart-outline" title={t('Dar nieko neišsaugojote','No saved pets yet')} body={t('Spauskite „Išsaugoti“ arba perbraukite kortelę dešinėn. Išsaugoti gyvūnai liks šiame įrenginyje.','Tap Save or swipe a card right. Saved pets stay on this device.')} action={t('Globoti','Discover')} onAction={()=>setTab('discover')}/>}
  </>:null}

  {tab==='shelters'?<>
   <View style={[s.toolbar,{paddingTop:4}]}><View style={{flex:1}}><Text accessibilityRole="header" style={s.heading}>{t('Prieglaudos','Shelters')}</Text><Text style={s.muted}>{t(`${organizations.length} ${pl(organizations.length,'organizacija','organizacijos','organizacijų')}`,`${organizations.length} organizations`)}</Text></View></View>
   <View style={s.toolbar}>
    <View style={s.search}>
     <Ionicons name="search" size={19} color={C.muted}/>
     <TextInput accessibilityLabel={t('Ieškoti prieglaudos','Search shelters')} placeholder={t('Pavadinimas arba miestas','Name or city')} placeholderTextColor={C.muted} value={search} onChangeText={setSearch} style={s.searchInput} autoCorrect={false}/>
    </View>
   </View>
   <FlatList keyboardShouldPersistTaps="handled" data={shelters} keyExtractor={org=>org.id} contentContainerStyle={{paddingHorizontal:16,paddingBottom:24,gap:10}}
    renderItem={({item,index})=><View style={{gap:10}}>
     {item.active===0&&(index===0||shelters[index-1].active>0)?<Text style={[s.sectionTitle,{marginTop:8}]}>{t('Be aktyvių Globis skelbimų','No active Globis listings')}</Text>:null}
     <Pressable accessibilityRole="button" accessibilityLabel={`${item.name}, ${item.city||''}, ${t(`laukia ${item.active}`,`${item.active} waiting`)}`} onPress={()=>setShelterId(item.id)} style={({pressed})=>[s.listCard,{flexDirection:'column',alignItems:'stretch'},pressed&&{opacity:0.85}]}>
      <View style={[s.row,{gap:12}]}>
      <Avatar name={item.name} logo={item.logo} logoBg={item.logoBg}/>
      <View style={{flex:1,minWidth:0,gap:4}}>
       <Text style={s.title}>{item.name}</Text>
       <Text style={s.muted}>{[item.city,item.active?t(`${item.active} laukia namų`,`${item.active} waiting for a home`):t('Šiuo metu skelbimų nėra','No current listings')].filter(Boolean).join(' · ')}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={C.muted}/>
      </View>
      {item.active?<View style={{flexDirection:'row',gap:6}} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
       {item.pets.filter(p=>eligible(p)&&p.photos?.[0]).slice(0,3).map(p=><CachedImage key={p.id} source={{uri:p.photos[0]}} cachePolicy="disk" contentFit="cover" style={{flex:1,aspectRatio:1,maxWidth:'33%',borderRadius:12,backgroundColor:C.surface2}}/>)}
      </View>:null}
     </Pressable>
    </View>}
    ListEmptyComponent={<Empty icon="home-outline" title={t('Prieglaudų nerasta','No shelters found')} action={t('Išvalyti paiešką ir filtrus','Clear search and filters')} onAction={()=>{setSearch('');setFilters({...defaults});}}/>}/>
  </>:null}

  {tab==='account'?<ScrollView contentContainerStyle={{paddingHorizontal:16,paddingBottom:24,gap:12,width:'100%',maxWidth:560,alignSelf:'center'}}>
   <Text accessibilityRole="header" style={[s.heading,{paddingTop:4}]}>{t('Paskyra','Account')}</Text>
    <AccountSection account={account} lang={lang}/>
   <Text style={s.sectionTitle}>{t('Kalba','Language')}</Text>
   <View accessibilityRole="radiogroup" style={{gap:8}}>
    {[['lt','🇱🇹','Lietuvių'],['en','🇬🇧','English']].map(([id,flag,label])=><Pressable key={id} accessibilityRole="radio" accessibilityLabel={label} accessibilityState={{checked:lang===id}} onPress={()=>dispatch({type:'language',lang:id})} style={({pressed})=>[s.listCard,pressed&&{opacity:0.85}]}>
     <Text style={{fontSize:24}} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">{flag}</Text>
     <Text style={[s.title,{flex:1}]}>{label}</Text>
     {lang===id?<Ionicons name="checkmark-circle" size={22} color={C.green}/>:null}
    </Pressable>)}
   </View>
   <Text style={s.sectionTitle}>{t('Nustatymai','Settings')}</Text>
   <Pressable accessibilityRole="button" accessibilityLabel={t('Apie GLOBIS','About GLOBIS')} onPress={()=>setAbout(true)} style={({pressed})=>[s.listCard,pressed&&{opacity:0.85}]}>
    <Ionicons name="information-circle-outline" size={22} color={C.ink}/>
    <Text style={[s.title,{flex:1}]}>{t('Apie GLOBIS','About GLOBIS')}</Text>
    <Ionicons name="chevron-forward" size={18} color={C.muted}/>
   </Pressable>
   <Pressable accessibilityRole="button" accessibilityLabel={t('Rodyti pristatymą iš naujo','Show the introduction again')} onPress={()=>{setTab('discover');dispatch({type:'replayOnboarding'});}} style={({pressed})=>[s.listCard,pressed&&{opacity:0.85}]}>
    <Ionicons name="play-circle-outline" size={22} color={C.ink}/>
    <Text style={[s.title,{flex:1}]}>{t('Rodyti pristatymą iš naujo','Show the introduction again')}</Text>
    <Ionicons name="chevron-forward" size={18} color={C.muted}/>
   </Pressable>
   <View style={{marginTop:24,gap:4}}>
    {config.extra?.termsUrl?<SourceLink lang={lang} url={config.extra.termsUrl} label={t('Naudojimo sąlygos','Terms of use')} onError={notify}/>:<Text style={s.muted}>{t('Naudojimo sąlygos dar nepaskelbtos.','Terms of use have not been published yet.')}</Text>}
    {config.extra?.privacyPolicyUrl?<SourceLink lang={lang} url={config.extra.privacyPolicyUrl} label={t('Privatumo politika','Privacy policy')} onError={notify}/>:<Text style={s.muted}>{t('Privatumo politika dar nepaskelbta.','The privacy policy has not been published yet.')}</Text>}
   </View>
  </ScrollView>:null}

  {toast?<View accessibilityLiveRegion="polite" style={s.toast}>
   <Text style={s.toastText}>{toast.text}</Text>
   {toast.action?<Pressable accessibilityRole="button" accessibilityLabel={toast.actionLabel||toast.action} onPress={()=>{toast.run();setToast(null);}} style={s.toastAction}><Text style={s.toastActionText}>{toast.action}</Text></Pressable>:null}
  </View>:null}

  <View style={s.tabsWrap}><View accessibilityRole="tablist" style={s.tabs}>
   {[['discover','paw',t('Globoti','Discover')],['shelters','home',t('Prieglaudos','Shelters')],['saved','heart',t('Išsaugoti','Saved')],['account','person',t('Paskyra','Account')]].map(([id,icon,label])=>{
    const on=tab===id,a11y=id==='saved'&&saved.length?`${label} (${saved.length})`:label;
    return <Pressable key={id} accessibilityRole="tab" accessibilityLabel={a11y} accessibilityState={{selected:on}} onPress={()=>setTab(id)} style={[s.tab,on&&s.tabActive]}>
     <Ionicons name={on?icon:`${icon}-outline`} size={22} color={on?C.green:C.muted}/>
     <Text maxFontSizeMultiplier={1.3} numberOfLines={1} style={[s.tabText,on&&s.tabTextActive]}>{label}</Text>
     {id==='saved'&&saved.length?<View style={s.tabBadge}><Text maxFontSizeMultiplier={1.2} style={s.tabBadgeText}>{saved.length}</Text></View>:null}
    </Pressable>;})}
  </View></View>
 </View>
 {about?<AboutSheet lang={lang} onClose={()=>setAbout(false)} reduced={reduced}/>:null}
 {filterOpen?<FilterSheet filters={filters} pets={PETS} lang={lang} reduced={reduced} onClose={()=>setFilterOpen(false)} onApply={next=>{setFilters(next);setFilterOpen(false);}}/>:null}
 {shelter?<Sheet full lang={lang} title={shelter.name} reduced={reduced} onClose={()=>setShelterId(null)}>
  {shelter.city||shelter.address?<View style={[s.row,{alignItems:'flex-start'}]}><Ionicons name="location-outline" size={17} color={C.muted} style={{marginTop:3}}/><Text selectable style={[s.body,{flex:1}]}>{shelter.address||shelter.city}</Text></View>:null}
  {shelter.address||shelter.city?<Directions lang={lang} place={[shelter.name,shelter.address||shelter.city].join(', ')} onError={notify}/>:null}
  <View style={s.tag}><Text style={s.tagText}>{t('Aktyvūs Globis skelbimai','Active Globis listings')}: {shelter.active}</Text></View>
  <SourceLink lang={lang} url={shelter.url} label={t('Prieglaudos šaltinis','Shelter source')} onError={notify}/>
  <Text style={s.sectionTitle}>{t('Gyvūnai GLOBIS','Animals on GLOBIS')}</Text>
  {shelter.pets.length?shelter.pets.map(p=><Pressable key={p.id} accessibilityRole="button" accessibilityLabel={`${p.name}. ${t('Atidaryti profilį','Open profile')}`} style={({pressed})=>[s.listCard,pressed&&{opacity:0.85}]} onPress={()=>{setShelterId(null);setProfile(p);}}>
   <View style={{width:56,height:56,borderRadius:14,overflow:'hidden'}}><Photo lang={lang} pet={p} height={56}/></View>
   <View style={{flex:1,minWidth:0,gap:4}}><Text style={s.title} numberOfLines={1}>{p.name}</Text><Status pet={p} lang={lang} small/></View>
   <Ionicons name="chevron-forward" size={18} color={C.muted}/>
  </Pressable>):<Empty icon="home-outline" title={t('Skelbimų nėra','No listings')} body={t('Šios prieglaudos skelbimų kopijoje nėra. Tai nereiškia, kad gyvūnų nėra, todėl pasiteiraukite prieglaudos.','No listings for this shelter in the snapshot. That does not mean it has no animals, so ask the shelter.')}/>}
 </Sheet>:null}
 {profile?<PetProfile key={profile.id} pet={profile} lang={lang} reduced={reduced} saved={isSaved(profile.id)} onClose={()=>setProfile(null)} onSave={save} onRemove={remove}
  onShelter={id=>{setProfile(null);setShelterId(id);}} onContact={pet=>{setProfile(null);setContact(pet);}} onError={notify}/>:null}
 {contact?<ContactSheet pet={contact} lang={lang} reduced={reduced} onClose={()=>setContact(null)} onError={notify}/>:null}
 </SafeAreaView>;
}
export default function GlobisApp(){
 const [fonts,fontError]=useFonts({Fraunces_600SemiBold});
 if(!fonts&&!fontError) return null; // a font that fails to load falls back to the system face
 return <GestureHandlerRootView style={{flex:1}}><SafeAreaProvider><AppContent/></SafeAreaProvider></GestureHandlerRootView>;
}
