import React,{useMemo,useRef,useState} from 'react';
import {View,Text,Image,Pressable,ScrollView,FlatList,TextInput,Animated,PanResponder,useWindowDimensions,StatusBar} from 'react-native';
import {SafeAreaProvider,SafeAreaView} from 'react-native-safe-area-context';
import {Ionicons} from '@expo/vector-icons';
import useDiscovery from '../state/useDiscovery';
import useReducedMotion from '../state/useReducedMotion';
import {shouldClaim} from '../state/discovery.cjs';
import {eligible} from '../data/integrity.cjs';
import {PETS} from '../data/pets';
import organizations from '../data/shelters.json';
import {defaults,selectPets,roster,activeFilters,pl} from './selectors.cjs';
import {C,styles as s} from './theme';
import {Avatar,Button,Chip,Empty,HeartButton,IconButton,Photo,Sheet,SourceLink,Status} from './ui';
import FilterSheet from './FilterSheet';
import AboutSheet from './AboutSheet';
import {PetProfile,ContactSheet} from './Profiles';

const THRESHOLD=80;

function SwipeSurface({pet,onSave,onPass,reduced,children}) {
 const x=useRef(new Animated.Value(0)).current;
 const callbacks=useRef({});callbacks.current={pet,onSave,onPass,reduced};
 const responder=useMemo(()=>PanResponder.create({
  onStartShouldSetPanResponder:()=>false,
  onMoveShouldSetPanResponder:(_,g)=>shouldClaim(g),
  onPanResponderMove:(_,g)=>{if(!callbacks.current.reduced)x.setValue(g.dx);},
  onPanResponderRelease:(_,g)=>{
   const c=callbacks.current;
   if(Math.abs(g.dx)<=THRESHOLD){Animated.spring(x,{toValue:0,useNativeDriver:false,friction:7}).start();return;}
   const decide=()=>{x.setValue(0);(g.dx>0?c.onSave:c.onPass)(c.pet);};
   if(c.reduced) decide();
   else Animated.timing(x,{toValue:g.dx>0?520:-520,duration:200,useNativeDriver:false}).start(decide);
  },
  onPanResponderTerminate:()=>x.setValue(0),
 }),[x]);
 const rotate=x.interpolate({inputRange:[-300,0,300],outputRange:['-14deg','0deg','14deg']});
 const saveOpacity=x.interpolate({inputRange:[0,THRESHOLD],outputRange:[0,1],extrapolate:'clamp'});
 const passOpacity=x.interpolate({inputRange:[-THRESHOLD,0],outputRange:[1,0],extrapolate:'clamp'});
 return <Animated.View {...responder.panHandlers} style={{transform:[{translateX:x},{rotate}]}}>
  {children}
  <Animated.View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[s.stamp,{left:16,borderColor:C.green,opacity:saveOpacity,transform:[{rotate:'-8deg'}]}]}><Text style={[s.stampText,{color:C.green}]}>IŠSAUGOTI</Text></Animated.View>
  <Animated.View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[s.stamp,{right:16,borderColor:C.ink2,opacity:passOpacity,transform:[{rotate:'8deg'}]}]}><Text style={[s.stampText,{color:C.ink2}]}>PRALEISTI</Text></Animated.View>
 </Animated.View>;
}

function AppContent() {
 const {state,dispatch,error,retry}=useDiscovery(), reduced=useReducedMotion();
 const [about,setAbout]=useState(false),[tab,setTab]=useState('discover'),[mode,setMode]=useState('cards'),[filters,setFilters]=useState({...defaults}),[filterOpen,setFilterOpen]=useState(false),[profile,setProfile]=useState(null),[contact,setContact]=useState(null),[shelterId,setShelterId]=useState(null),[search,setSearch]=useState(''),[toast,setToast]=useState(null);
 const timer=useRef(null);
 const {height,width}=useWindowDimensions();
 const lang=state.lang,t=(lt,en)=>lang==='lt'?lt:en;
 const filtered=useMemo(()=>selectPets(PETS,filters),[filters]);
 const pending=useMemo(()=>filtered.filter(p=>!state.saved.includes(p.id)&&!state.passed.includes(p.id)),[filtered,state.saved,state.passed]);
 const saved=useMemo(()=>state.saved.map(id=>PETS.find(p=>p.id===id)).filter(Boolean),[state.saved]);
 const speciesCount=useMemo(()=>{const base=selectPets(PETS,{...filters,species:'all'});return {all:base.length,dog:base.filter(p=>p.species==='dog').length,cat:base.filter(p=>p.species==='cat').length};},[filters]);
 const notify=value=>{clearTimeout(timer.current);setToast(typeof value==='string'?{text:value}:value);timer.current=setTimeout(()=>setToast(null),5000);};
 const isSaved=id=>state.saved.includes(id);
 const save=pet=>{if(!eligible(pet))return;dispatch({type:'save',id:pet.id});notify({text:t(`Išsaugota: ${pet.name}`,`Saved: ${pet.name}`),action:t('Atšaukti','Undo'),actionLabel:t('Atšaukti išsaugojimą','Undo save'),run:()=>dispatch({type:'undo'})});};
 const remove=pet=>{dispatch({type:'remove',id:pet.id});notify({text:t(`Pašalinta: ${pet.name}`,`Removed: ${pet.name}`),action:t('Grąžinti','Restore'),run:()=>dispatch({type:'save',id:pet.id})});};
 const pass=pet=>{dispatch({type:'pass',id:pet.id});};
 const columns=width>900?4:width>600?3:2;
 const nf=activeFilters(filters);
 const setQuery=query=>setFilters(f=>({...f,query}));
 const resetAll=()=>{setFilters({...defaults});dispatch({type:'resetPassed'});};

 const petItem=(pet,inSaved=false)=><View style={s.gcard}>
  <View style={s.gphoto}>
   <Pressable accessibilityRole="button" accessibilityLabel={`${t('Atidaryti profilį','Open profile')}: ${pet.name}`} onPress={()=>setProfile(pet)}>
    <Photo lang={lang} pet={pet} height={Math.round(Math.min(260,Math.max(150,(width-24)/columns*1.15)))}>
     {pet.status==='reserved'?<View style={[s.onPhoto,{left:8,bottom:8}]}><Status pet={pet} lang={lang} small/></View>:null}
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

 const shelters=useMemo(()=>organizations.map(org=>{const pets=roster(PETS,org.id),active=pets.filter(eligible);return {...org,pets,active:active.length,matching:active.filter(p=>filters.species==='all'||p.species===filters.species).length};}).filter(org=>org.name.toLocaleLowerCase('lt').includes(search.toLocaleLowerCase('lt'))&&(filters.species==='all'||org.matching>0)&&(filters.city==='all'||org.city===filters.city)).sort((a,b)=>b.active-a.active),[search,filters]);
 const shelter=shelterId?(()=>{const org=organizations.find(o=>o.id===shelterId);if(!org)return null;const pets=roster(PETS,org.id);return {...org,pets,active:pets.filter(eligible).length};})():null;

 const top=pending[0];
 const photoH=Math.round(Math.min(440,Math.max(200,height*0.40)));

 return <SafeAreaView style={s.root} edges={['top','bottom']}><StatusBar barStyle="dark-content" backgroundColor={C.bg}/><View style={s.shell}>
  <View style={s.header}>
   <Pressable accessibilityRole="button" accessibilityLabel="Apie GLOBIS" onPress={()=>setAbout(true)} style={{minHeight:48,justifyContent:'center'}}>
    <Image source={require('../../Code_Generated_Image.png')} accessibilityLabel="GLOBIS" style={[s.logo,width<360&&{width:100}]} resizeMode="contain"/>
   </Pressable>
   <View style={s.row}>
    <Button label={lang.toUpperCase()} accessibilityLabel={lang.toUpperCase()} onPress={()=>dispatch({type:'language',lang:lang==='lt'?'en':'lt'})} style={{minWidth:52,paddingHorizontal:12}}/>
    <IconButton icon="information-circle-outline" label={t('Apie programėlę','About the app')} onPress={()=>setAbout(true)}/>
   </View>
  </View>

  {error?<View style={s.banner}><Text accessibilityRole="alert" style={[s.body,{color:C.warnInk}]}>{error}</Text><Button label={t('Bandykite dar kartą','Retry')} onPress={retry} style={{alignSelf:'flex-start'}}/></View>:null}

  {tab==='discover'?<>
   <View style={s.toolbar}>
    <View style={s.search}>
     <Ionicons name="search" size={19} color={C.muted}/>
     <TextInput accessibilityLabel={t('Ieškoti gyvūnų','Search animals')} placeholder={t('Vardas, miestas, prieglauda','Name, city, shelter')} placeholderTextColor={C.muted}
      value={filters.query} onChangeText={setQuery} style={s.searchInput} returnKeyType="search" autoCorrect={false}/>
     {filters.query?<IconButton icon="close" size={18} color={C.muted} label={t('Išvalyti paiešką','Clear search')} onPress={()=>setQuery('')} style={{width:40,height:40}}/>:null}
    </View>
    <Pressable accessibilityRole="button" accessibilityLabel={t('Filtrai','Filters')} accessibilityHint={nf?t(`Aktyvūs filtrai: ${nf}`,`Active filters: ${nf}`):undefined} onPress={()=>setFilterOpen(true)} style={({pressed})=>[s.filterBtn,nf&&s.filterBtnOn,pressed&&{opacity:0.8}]}>
     <Ionicons name="options-outline" size={21} color={nf?C.white:C.ink}/>
     {nf?<View style={s.countBadge}><Text style={s.countBadgeText}>{nf}</Text></View>:null}
    </Pressable>
   </View>
   <View style={[s.toolbar,{paddingBottom:10}]}>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:6,paddingRight:4}} style={{flex:1}}>
     {[['all',t('Visi','All')],['dog',t('Šunys','Dogs')],['cat',t('Katės','Cats')]].map(([id,label])=><Chip key={id} label={label} count={speciesCount[id]} selected={filters.species===id} onPress={()=>setFilters(f=>({...f,species:id}))}/>)}
    </ScrollView>
    <View style={s.seg} accessibilityRole="radiogroup">
     <Pressable accessibilityRole="button" accessibilityLabel={t('Kortelės','Cards')} accessibilityState={{selected:mode==='cards'}} onPress={()=>setMode('cards')} style={[s.segBtn,mode==='cards'&&s.segOn]}><Ionicons name="albums-outline" size={19} color={mode==='cards'?C.green:C.muted}/></Pressable>
     <Pressable accessibilityRole="button" accessibilityLabel={t('Tinklelis','Grid')} accessibilityState={{selected:mode==='grid'}} onPress={()=>setMode('grid')} style={[s.segBtn,mode==='grid'&&s.segOn]}><Ionicons name="grid-outline" size={19} color={mode==='grid'?C.green:C.muted}/></Pressable>
    </View>
   </View>

   {mode==='grid'?<>{pending.length?<Text style={[s.muted,{paddingHorizontal:16,paddingBottom:4}]}>{t(`${pending.length} ${pl(pending.length,'skelbimas','skelbimai','skelbimų')} pagal filtrus`,`${pending.length} ${pending.length===1?'listing matches':'listings match'}`)}</Text>:null}{list(pending)}</>
   :top?<ScrollView contentContainerStyle={{paddingHorizontal:16,paddingBottom:16,width:'100%',maxWidth:480,alignSelf:'center'}}>
     <SwipeSurface key={top.id} pet={top} onSave={save} onPass={pass} reduced={reduced}>
      <View style={s.card}>
       <Photo lang={lang} pet={top} height={photoH} gallery>
        <View style={[s.onPhoto,{top:12,left:12}]}><Status pet={top} lang={lang} small/></View>
        <View style={[s.onPhoto,{top:12,right:12}]}><View style={s.countChip}><Text style={s.countChipText} accessibilityLabel={t(`Liko peržiūrėti: ${pending.length}`,`Left to review: ${pending.length}`)}>{t(`Liko ${pending.length}`,`${pending.length} left`)}</Text></View></View>
       </Photo>
       <Pressable accessibilityRole="button" accessibilityLabel={`${t('Atidaryti profilį','Open profile')}: ${top.name}`} onPress={()=>setProfile(top)} style={({pressed})=>[s.cardInfo,pressed&&{backgroundColor:C.bg}]}>
        <View style={[s.row,{alignItems:'baseline'}]}>
         <Text style={s.cardName} numberOfLines={1}>{top.name}</Text>
         {(lang==='lt'?top.ageLt:top.ageEn)?<Text style={[s.body,{fontWeight:'500'}]}>{lang==='lt'?top.ageLt:top.ageEn}</Text>:null}
         <View style={{flex:1}}/>
         <Text style={s.more}>{t('Plačiau','Details')} ›</Text>
        </View>
        <View style={[s.row,{gap:6}]}><Ionicons name="location-outline" size={15} color={C.muted}/><Text style={[s.muted,{flex:1}]} numberOfLines={1}>{[top.city||t('Miestas nenurodytas','City not listed'),top.shelter?.name].filter(Boolean).join(' · ')}</Text></View>
       </Pressable>
      </View>
     </SwipeSurface>
     <View style={s.actions}>
      <Pressable accessibilityRole="button" accessibilityLabel={t('Atšaukti','Undo')} accessibilityState={{disabled:!state.history.length}} disabled={!state.history.length} onPress={()=>dispatch({type:'undo'})} style={({pressed})=>[s.act,s.actSmall,!state.history.length&&s.disabled,pressed&&{transform:[{scale:0.95}]}]}><Ionicons name="arrow-undo-outline" size={20} color={C.ink2}/></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={t('Praleisti','Pass')} onPress={()=>pass(top)} style={({pressed})=>[s.act,s.actRound,pressed&&{transform:[{scale:0.95}]}]}><Ionicons name="close" size={26} color={C.ink2}/></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={t('Išsaugoti','Save')} onPress={()=>save(top)} style={({pressed})=>[s.act,s.actSave,pressed&&{transform:[{scale:0.97}]}]}><Ionicons name="heart-outline" size={21} color={C.white}/><Text style={s.actSaveText}>{t('Išsaugoti','Save')}</Text></Pressable>
     </View>
     <Text style={s.hint}>{t('Perbraukite dešinėn, kad išsaugotumėte, kairėn, kad praleistumėte','Swipe right to save, left to pass')}</Text>
    </ScrollView>
   :filtered.length?<Empty icon="checkmark-done-outline" title={t('Peržiūrėjote visus skelbimus','You have seen every listing')}
     body={t('Išsaugotus gyvūnus rasite skiltyje „Išsaugoti“.','Saved animals are in the Saved tab.')}
     action={state.history.length?t('Atšaukti','Undo'):t('Peržiūrėti praleistus','Review passed')} onAction={()=>state.history.length?dispatch({type:'undo'}):dispatch({type:'resetPassed'})}
     secondary={t('Rodyti tinkleliu','Show grid')} onSecondary={()=>setMode('grid')}/>
   :noMatches}
  </>:null}

  {tab==='saved'?<>
   <View style={[s.toolbar,{paddingTop:4}]}><View style={{flex:1}}><Text accessibilityRole="header" style={s.heading}>{t('Išsaugoti','Saved')}</Text><Text style={s.muted}>{saved.length?t(`${saved.length} ${pl(saved.length,'gyvūnas','gyvūnai','gyvūnų')} · laikoma šiame įrenginyje`,`${saved.length} ${saved.length===1?'animal':'animals'} · stored on this device`):t('Paskyros nereikia','No account needed')}</Text></View></View>
   {saved.length?list(saved,true):<Empty icon="heart-outline" title={t('Dar nieko neišsaugojote','No saved pets yet')} body={t('Spauskite „Išsaugoti“ arba perbraukite kortelę dešinėn. Išsaugoti gyvūnai liks šiame įrenginyje.','Tap Save or swipe a card right. Saved pets stay on this device.')} action={t('Globoti','Discover')} onAction={()=>setTab('discover')}/>}
  </>:null}

  {tab==='shelters'?<>
   <View style={[s.toolbar,{paddingTop:4}]}><View style={{flex:1}}><Text accessibilityRole="header" style={s.heading}>{t('Prieglaudos','Shelters')}</Text><Text style={s.muted}>{t(`${organizations.length} ${pl(organizations.length,'organizacija','organizacijos','organizacijų')}`,`${organizations.length} organizations`)}</Text></View></View>
   <View style={s.toolbar}>
    <View style={s.search}>
     <Ionicons name="search" size={19} color={C.muted}/>
     <TextInput accessibilityLabel={t('Ieškoti prieglaudos','Search shelters')} placeholder={t('Ieškoti pagal pavadinimą','Search by name')} placeholderTextColor={C.muted} value={search} onChangeText={setSearch} style={s.searchInput} autoCorrect={false}/>
    </View>
   </View>
   <FlatList keyboardShouldPersistTaps="handled" data={shelters} keyExtractor={org=>org.id} contentContainerStyle={{paddingHorizontal:16,paddingBottom:24,gap:10}}
    renderItem={({item,index})=><View style={{gap:10}}>
     {item.active===0&&(index===0||shelters[index-1].active>0)?<Text style={[s.sectionTitle,{marginTop:8}]}>{t('Be aktyvių Globis skelbimų','No active Globis listings')}</Text>:null}
     <Pressable accessibilityRole="button" accessibilityLabel={`${item.name}, ${item.city||''}`} onPress={()=>setShelterId(item.id)} style={({pressed})=>[s.listCard,pressed&&{opacity:0.85}]}>
      <Avatar name={item.name}/>
      <View style={{flex:1,minWidth:0,gap:4}}>
       <Text style={s.title}>{item.name}</Text>
       {item.city?<Text style={s.muted}>{item.city}</Text>:null}
       <View style={s.tag}><Text style={s.tagText}>{t('Aktyvūs Globis skelbimai','Active Globis listings')}: {item.active}</Text></View>
      </View>
      <Ionicons name="chevron-forward" size={18} color={C.muted}/>
     </Pressable>
    </View>}
    ListEmptyComponent={<Empty icon="home-outline" title={t('Prieglaudų nerasta','No shelters found')} action={t('Išvalyti paiešką ir filtrus','Clear search and filters')} onAction={()=>{setSearch('');setFilters({...defaults});}}/>}/>
  </>:null}

  {toast?<View accessibilityLiveRegion="polite" style={s.toast}>
   <Text style={s.toastText}>{toast.text}</Text>
   {toast.action?<Pressable accessibilityRole="button" accessibilityLabel={toast.actionLabel||toast.action} onPress={()=>{toast.run();setToast(null);}} style={s.toastAction}><Text style={s.toastActionText}>{toast.action}</Text></Pressable>:null}
  </View>:null}

  <View style={s.tabsWrap}><View accessibilityRole="tablist" style={s.tabs}>
   {[['discover','paw',t('Globoti','Discover')],['shelters','home',t('Prieglaudos','Shelters')],['saved','heart',t('Išsaugoti','Saved')]].map(([id,icon,label])=>{
    const on=tab===id,a11y=id==='saved'&&saved.length?`${label} (${saved.length})`:label;
    return <Pressable key={id} accessibilityRole="tab" accessibilityLabel={a11y} accessibilityState={{selected:on}} onPress={()=>setTab(id)} style={[s.tab,on&&s.tabActive]}>
     <Ionicons name={on?icon:`${icon}-outline`} size={22} color={on?C.green:C.muted}/>
     <Text style={[s.tabText,on&&s.tabTextActive]}>{label}</Text>
     {id==='saved'&&saved.length?<View style={s.tabBadge}><Text style={s.tabBadgeText}>{saved.length}</Text></View>:null}
    </Pressable>;})}
  </View></View>
 </View>
 {about?<AboutSheet onClose={()=>setAbout(false)} reduced={reduced}/>:null}
 {filterOpen?<FilterSheet filters={filters} pets={PETS} lang={lang} reduced={reduced} onClose={()=>setFilterOpen(false)} onApply={next=>{setFilters(next);setFilterOpen(false);}}/>:null}
 {shelter?<Sheet full title={shelter.name} reduced={reduced} onClose={()=>setShelterId(null)}>
  {shelter.city||shelter.address?<View style={[s.row,{alignItems:'flex-start'}]}><Ionicons name="location-outline" size={17} color={C.muted} style={{marginTop:3}}/><Text selectable style={[s.body,{flex:1}]}>{shelter.address||shelter.city}</Text></View>:null}
  <View style={s.tag}><Text style={s.tagText}>{t('Aktyvūs Globis skelbimai','Active Globis listings')}: {shelter.active}</Text></View>
  <SourceLink url={shelter.url} label={t('Prieglaudos šaltinis','Shelter source')}/>
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
export default function GlobisApp(){return <SafeAreaProvider><AppContent/></SafeAreaProvider>;}
