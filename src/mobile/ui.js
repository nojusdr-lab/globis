import React,{useEffect,useState} from 'react';
import {View,Text,Image,Pressable,Modal,ScrollView,Linking} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {C,styles as s} from './theme';
export function Button({label,icon,onPress,primary=false,disabled=false,selected=false,style,testID,compact=false}) {
 return <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{disabled,selected}} disabled={disabled} onPress={onPress} style={({pressed})=>[s.button,primary&&s.primary,selected&&s.selected,disabled&&s.disabled,pressed&&{opacity:0.72},style]}>{icon?<Ionicons name={icon} size={22} color={primary||selected?C.white:C.green}/>:null}{label&&!compact?<Text style={[s.buttonText,(primary||selected)&&s.primaryText]}>{label}</Text>:null}</Pressable>;
}
export function Photo({pet,height=280,gallery=false}) {
 const [index,setIndex]=useState(0),[failed,setFailed]=useState(false);
 const photos=(pet.photos||[]).filter(url=>typeof url==='string'&&/^https?:\/\//.test(url));
 useEffect(()=>{setIndex(0);setFailed(false);},[pet.id]);
 const move=delta=>{setFailed(false);setIndex(i=>(i+delta+photos.length)%photos.length);};
 return <View><View style={[s.photo,{height}]}>{photos[index]&&!failed?<Image accessibilityLabel={`${pet.name}, nuotrauka ${index+1}`} source={{uri:photos[index]}} onError={()=>setFailed(true)} style={{width:'100%',height:'100%'}} resizeMode="cover"/>:<View style={[s.photo,s.placeholder,{height}]}><Ionicons name="paw-outline" size={40} color={C.green}/><Text style={s.muted}>Nuotraukos nėra</Text></View>}</View>{gallery&&photos.length>1?<View style={[s.row,{justifyContent:'space-between',padding:8}]}><Button icon="chevron-back" label="Ankstesnė" onPress={()=>move(-1)}/><Text style={s.muted}>{index+1} / {photos.length}</Text><Button icon="chevron-forward" label="Kita" onPress={()=>move(1)}/></View>:null}</View>;
}
export function Status({pet,lang='lt'}) {return <Text style={[s.status,pet.status==='reserved'&&s.reserved]}>{pet.status==='reserved'?(lang==='lt'?'Rezervuotas':'Reserved'):pet.status==='unknown'||!pet.status?(lang==='lt'?'Prieinamumas nepatvirtintas':'Availability unconfirmed'):null}</Text>;}
export function Empty({title,body,action,onAction}) {return <View style={s.empty}><Ionicons name="paw-outline" size={40} color={C.green}/><Text style={s.title}>{title}</Text>{body?<Text style={[s.body,{textAlign:'center'}]}>{body}</Text>:null}{action?<Button label={action} onPress={onAction}/>:null}</View>;}
export function Sheet({title,children,footer,onClose,reduced=false,full=false}) {
 const insets=useSafeAreaInsets();
 return <Modal visible transparent animationType={reduced?'none':'slide'} onRequestClose={onClose}><View style={[s.modal,{paddingTop:insets.top}]}><Pressable accessibilityLabel="Uždaryti skydelį" accessibilityRole="button" onPress={onClose} style={s.backdrop}/><View accessibilityViewIsModal style={[s.sheet,full&&{height:'94%'}]}><View style={s.sheetHeader}><Text accessibilityRole="header" style={[s.title,{flex:1}]}>{title}</Text><Button label="Uždaryti" icon="close" onPress={onClose}/></View><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.content}>{children}</ScrollView>{footer?<View style={[s.sheetFooter,{paddingBottom:Math.max(insets.bottom,16)}]}>{footer}</View>:<View style={{height:insets.bottom}}/>}</View></View></Modal>;
}
export function SourceLink({url,label='Originalus skelbimas',onError}) {
 return url&&/^https?:\/\//.test(url)?<Pressable accessibilityRole="link" accessibilityLabel={label} onPress={()=>Linking.openURL(url).catch(()=>onError?.('Nepavyko atidaryti nuorodos.'))} style={{minHeight:48,justifyContent:'center'}}><Text selectable style={s.link}>{label} ↗</Text></Pressable>:null;
}
