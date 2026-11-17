import React,{useEffect,useState} from 'react';
import {View,Text,Image,Pressable,Modal,ScrollView,Linking,Platform} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {Image as CachedImage} from 'expo-image';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {C,styles as s} from './theme';

export function Button({label,icon,onPress,primary=false,soft=false,disabled=false,selected=false,style,testID,compact=false,accessibilityLabel}) {
 const light=primary||selected;
 return <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={accessibilityLabel||label} accessibilityState={{disabled,selected}} disabled={disabled} onPress={onPress}
  style={({pressed})=>[s.button,soft&&s.soft,primary&&s.primary,selected&&s.selected,disabled&&s.disabled,pressed&&{opacity:0.8,transform:[{scale:0.97}]},style]}>
  {icon?<Ionicons name={icon} size={20} color={light?C.white:C.green}/>:null}
  {label&&!compact?<Text maxFontSizeMultiplier={1.4} style={[s.buttonText,light&&s.primaryText]}>{label}</Text>:null}
 </Pressable>;
}

export function IconButton({icon,label,onPress,style,color=C.ink,size=22,disabled=false}) {
 return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{disabled}} disabled={disabled} onPress={onPress}
  style={({pressed})=>[s.iconButton,disabled&&s.disabled,pressed&&{opacity:0.7},style]}>
  <Ionicons name={icon} size={size} color={color}/>
 </Pressable>;
}

export function Chip({label,count,selected,onPress}) {
 return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{selected:!!selected}} onPress={onPress}
  style={({pressed})=>[s.chip,selected&&s.chipOn,pressed&&{opacity:0.8}]}>
  <Text maxFontSizeMultiplier={1.4} style={[s.chipText,selected&&s.chipTextOn]}>{label}</Text>
  {count!=null?<Text maxFontSizeMultiplier={1.4} style={[s.chipCount,selected&&s.chipCountOn]}>{count}</Text>:null}
 </Pressable>;
}

export function HeartButton({saved,onPress,name,lang='lt',disabled=false}) {
 const label=saved?(lang==='lt'?`Pašalinti iš išsaugotų: ${name}`:`Remove from saved: ${name}`):(lang==='lt'?`Išsaugoti: ${name}`:`Save: ${name}`);
 return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{selected:!!saved,disabled}} disabled={disabled} onPress={onPress}
  style={({pressed})=>[s.heart,disabled&&s.disabled,pressed&&{transform:[{scale:0.92}]}]}>
  <Ionicons name={saved?'heart':'heart-outline'} size={20} color={saved?C.green:C.ink2}/>
 </Pressable>;
}

function PhotoImage({uri,label,height,lang}) {
 const [failed,setFailed]=useState(false);
 if(uri&&!failed){
  return <View pointerEvents="none" style={{width:'100%',height:'100%'}}><CachedImage accessibilityLabel={label} source={{uri}} onError={()=>setFailed(true)} style={{width:'100%',height:'100%'}} contentFit="cover" cachePolicy="memory-disk" transition={150}/></View>;
 }
 return <View style={[s.photo,s.placeholder,{height}]}>
  <Ionicons name="paw-outline" size={40} color={C.green}/>
  <Text style={s.muted}>{lang==='lt'?'Nuotraukos nėra':'Photo unavailable'}</Text>
 </View>;
}
export function Photo({pet,height=280,gallery=false,tapToBrowse=false,lang='lt',children}) {
 const [index,setIndex]=useState(0);
 const photos=(pet.photos||[]).filter(url=>typeof url==='string'&&/^https?:\/\//.test(url));
 useEffect(()=>setIndex(0),[pet.id]);
 const currentIndex=index<photos.length?index:0;
 const uri=photos[currentIndex];
 const move=delta=>setIndex(i=>((i<photos.length?i:0)+delta+photos.length)%photos.length);
 return <View>
  <View style={[s.photo,{height}]}>
   <PhotoImage key={JSON.stringify([pet.id,currentIndex,uri])} uri={uri} label={`${pet.name}, ${lang==='lt'?'nuotrauka':'photo'} ${currentIndex+1}`} height={height} lang={lang}/>
   {tapToBrowse&&photos.length>1?<>
    <View pointerEvents="none" style={{position:'absolute',top:8,left:12,right:12,flexDirection:'row',gap:4,zIndex:3}}>
     {photos.map((_,i)=><View key={i} style={{flex:1,height:3,borderRadius:2,backgroundColor:i===currentIndex?'#FFFFFF':'rgba(255,255,255,0.45)'}}/>)}
    </View>
    {/* Top 60% only: the bottom of the card opens the profile. */}
    <Pressable accessibilityRole="button" accessibilityLabel={lang==='lt'?'Ankstesnė nuotrauka':'Previous photo'} onPress={()=>move(-1)} style={{position:'absolute',left:0,top:0,width:'40%',height:'60%',zIndex:2}}/>
    <Pressable accessibilityRole="button" accessibilityLabel={lang==='lt'?'Kita nuotrauka':'Next photo'} onPress={()=>move(1)} style={{position:'absolute',right:0,top:0,width:'40%',height:'60%',zIndex:2}}/>
   </>:null}
   {children}
  </View>
  {gallery&&photos.length>1?<View style={[s.row,{justifyContent:'space-between',padding:8}]}>
   <Button icon="chevron-back" label={lang==='lt'?'Ankstesnė':'Previous'} onPress={()=>move(-1)}/>
   <Text style={s.muted}>{currentIndex+1} / {photos.length}</Text>
   <Button icon="chevron-forward" label={lang==='lt'?'Kita':'Next'} onPress={()=>move(1)}/>
  </View>:null}
 </View>;
}

// Availability is shown exactly as the source supports it. Missing status is never shown as available.
export function statusInfo(pet,lang='lt') {
 const lt=lang==='lt';
 if(pet.status==='reserved') return {tone:'warn',icon:'time-outline',label:lt?'Rezervuotas':'Reserved',
  note:lt?'Prieglauda nurodė, kad gyvūnas rezervuotas. Jei rezervacija nepavyks, jis vėl gali ieškoti namų.':'The shelter marked this animal as reserved. If the reservation falls through, it may look for a home again.'};
 if(pet.status==='no_longer_listed') return {tone:'muted',icon:'eye-off-outline',label:lt?'Nebeskelbiamas':'No longer listed',
  note:lt?'Prieglauda šio gyvūno nebeskelbia. Tai nereiškia, kad jis įvaikintas. Paklauskite prieglaudos.':'The shelter no longer lists this animal. That does not mean it was adopted. Ask the shelter.'};
 if(pet.status==='available') return {tone:'ok',icon:'checkmark',label:lt?'Ieško namų':'Looking for a home',
  note:lt?'Prieglauda šiuo metu skelbia šį gyvūną.':'The shelter currently lists this animal.'};
 return {tone:'muted',icon:'help-circle-outline',label:lt?'Prieinamumas nepatvirtintas':'Availability unconfirmed',
  note:lt?'Neturime patikimos informacijos, ar gyvūnas vis dar ieško namų. Prieš planuodami vizitą paklauskite prieglaudos.':'We have no reliable confirmation that this animal is still looking for a home. Ask the shelter before planning a visit.'};
}
const TONES={ok:[C.okBg,C.okInk],warn:[C.warnBg,C.warnInk],muted:[C.mutBg,C.mutInk]};
export function Status({pet,lang='lt',small=false}) {
 const st=statusInfo(pet,lang);const [bg,ink]=TONES[st.tone];
 return <View style={[s.status,{backgroundColor:bg},small&&{height:24}]}>
  <Ionicons name={st.icon} size={small?12:14} color={ink}/>
  <Text maxFontSizeMultiplier={1.3} style={[s.statusText,{color:ink},small&&{fontSize:11.5}]} numberOfLines={1}>{st.label}</Text>
 </View>;
}
export function StatusNote({pet,lang='lt'}) {
 const st=statusInfo(pet,lang);const [bg,ink]=TONES[st.tone];
 return <View style={[s.note,{backgroundColor:bg}]} accessibilityRole="text">
  <Ionicons name={st.icon} size={18} color={ink} style={{marginTop:2}}/>
  <Text style={{flex:1,color:ink,fontSize:14,lineHeight:20}}><Text style={{fontWeight:'700'}}>{st.label}</Text>{`. ${st.note}`}</Text>
 </View>;
}

export function Empty({title,body,action,onAction,icon='paw-outline'}) {
 return <View style={s.empty}>
  <View style={s.emptyArt}><Ionicons name={icon} size={34} color={C.green}/></View>
  <Text accessibilityRole="header" style={s.emptyTitle}>{title}</Text>
  {body?<Text style={[s.body,{textAlign:'center',maxWidth:320}]}>{body}</Text>:null}
  {action?<Button primary label={action} onPress={onAction} style={{minWidth:220}}/>:null}
 </View>;
}

export function Sheet({title,children,footer,onClose,reduced=false,full=false,lang='lt'}) {
 const insets=useSafeAreaInsets();
 const lt=lang==='lt';
 return <Modal visible transparent animationType={reduced?'none':'slide'} onRequestClose={onClose}>
  <View style={[s.modal,{paddingTop:insets.top}]}>
   <Pressable accessibilityLabel={lt?'Uždaryti skydelį':'Close panel'} accessibilityRole="button" onPress={onClose} style={s.backdrop}/>
   <View accessibilityViewIsModal style={[s.sheet,full&&{height:'94%'}]}>
    <View style={s.grab}/>
    <View style={s.sheetHeader}>
     <Text accessibilityRole="header" maxFontSizeMultiplier={1.6} style={s.sheetTitle} numberOfLines={2}>{title}</Text>
     <Pressable accessibilityRole="button" accessibilityLabel={lt?'Uždaryti':'Close'} onPress={onClose} style={({pressed})=>[s.iconButton,{backgroundColor:C.surface2,width:44,height:44},pressed&&{opacity:0.7}]}>
      <Ionicons name="close" size={20} color={C.ink}/>
     </Pressable>
    </View>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[s.content,{paddingTop:4}]}>{children}</ScrollView>
    {footer?<View style={[s.sheetFooter,{paddingBottom:Math.max(insets.bottom,12)}]}>{footer}</View>:<View style={{height:insets.bottom}}/>}
   </View>
  </View>
 </Modal>;
}

export function SourceLink({url,label,onError,lang='lt'}) {
 const lt=lang==='lt';
 label=label||(lt?'Originalus skelbimas':'Original listing');
 return url&&/^https?:\/\//.test(url)?<Pressable accessibilityRole="link" accessibilityLabel={label} onPress={()=>Linking.openURL(url).catch(()=>onError?.(lt?'Nepavyko atidaryti nuorodos.':'Could not open the link.'))} style={{minHeight:48,justifyContent:'center'}}><Text selectable style={s.link}>{label} ↗</Text></Pressable>:null;
}

export const initials=name=>String(name||'').replace(/[„“"()]/g,'').replace(/^(VšĮ|Asociacija|Gyvūnų globos draugija)\s+/i,'')
 .split(/\s+/).filter(Boolean).slice(0,2).map(w=>w[0].toUpperCase()).join('')||'?';
export function Avatar({name,logo,size=46}) {
 const [broken,setBroken]=useState(false);
 const box={width:size,height:size,borderRadius:size/2};
 if(logo&&!broken) return <CachedImage source={{uri:logo}} onError={()=>setBroken(true)} contentFit="contain" cachePolicy="memory-disk" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[box,{backgroundColor:C.white}]}/>;
 return <View style={[s.avatar,box]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"><Text style={[s.avatarText,size>50&&{fontSize:19}]}>{initials(name)}</Text></View>;
}

// Universal links open the installed app, otherwise the web map, which offers the app download.
export function Directions({place,onError,lang='lt'}) {
 const q=encodeURIComponent(place),lt=lang==='lt';
 const apps=[['Google Maps',`https://www.google.com/maps/dir/?api=1&destination=${q}`],['Waze',`https://waze.com/ul?q=${q}&navigate=yes`],...(Platform.OS==='ios'?[['Apple Maps',`https://maps.apple.com/?daddr=${q}`]]:[])];
 return <View style={{gap:8}}>
  <Text style={s.sectionTitle}>{lt?'Kaip nuvykti':'Directions'}</Text>
  <View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>
   {apps.map(([name,url])=><Button key={name} label={name} icon="navigate-outline" accessibilityLabel={`${lt?'Kaip nuvykti su':'Directions in'} ${name}`} onPress={()=>Linking.openURL(url).catch(()=>onError?.(lt?'Nepavyko atidaryti nuorodos.':'Could not open the link.'))}/>)}
  </View>
 </View>;
}
