// Optional sign-in with a 6-digit email code. Browsing and saving never need it.
import React,{useState} from 'react';
import {View,Text,TextInput,Pressable,ActivityIndicator} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {Button} from './ui';
import {C,styles as s} from './theme';

const EMAIL=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function AccountSection({account,lang}) {
 const t=(lt,en)=>lang==='lt'?lt:en;
 const [email,setEmail]=useState(''),[code,setCode]=useState(''),[step,setStep]=useState('email');
 const [busy,setBusy]=useState(false),[error,setError]=useState(null),[confirmDelete,setConfirmDelete]=useState(false);
 if(!account.available) return null;

 const run=async(fn,next)=>{
  setBusy(true);setError(null);
  try{const {error:e}=await fn();if(e)throw e;next?.();}
  catch(e){setError(e?.status===429||/rate/i.test(e?.message||'')
   ?t('Per daug bandymų. Palaukite kelias minutes ir bandykite vėl.','Too many attempts. Wait a few minutes and try again.')
   :step==='code'?t('Kodas netinka arba nebegalioja. Patikrinkite arba gaukite naują.','The code is wrong or expired. Check it or request a new one.')
   :t('Nepavyko. Patikrinkite interneto ryšį ir bandykite vėl.','That did not work. Check your connection and try again.'));}
  finally{setBusy(false);}
 };

 if(account.email) return <View style={{gap:8}}>
  <Text style={s.sectionTitle}>{t('Paskyra','Account')}</Text>
  <View style={s.listCard}>
   <Ionicons name="person-circle-outline" size={24} color={C.green}/>
   <View style={{flex:1,minWidth:0}}>
    <Text style={s.title} numberOfLines={1}>{account.email}</Text>
    <Text style={s.muted}>{t('Išsaugoti gyvūnai sinchronizuojami','Saved animals are synced')}</Text>
   </View>
  </View>
  <Button label={t('Atsijungti','Sign out')} icon="log-out-outline" onPress={()=>run(account.signOut)}/>
  {confirmDelete?<View style={[s.listCard,{flexDirection:'column',alignItems:'stretch',gap:10}]}>
   <Text style={s.body}>{t('Paskyra ir jos išsaugotų sąrašas bus ištrinti visam laikui. Šiame įrenginyje išsaugoti gyvūnai liks.','Your account and its saved list will be deleted permanently. Animals saved on this device stay.')}</Text>
   <View style={s.row}>
    <Button style={{flex:1}} label={t('Atšaukti','Cancel')} onPress={()=>setConfirmDelete(false)}/>
    <Button style={{flex:1}} primary label={t('Ištrinti','Delete')} onPress={()=>run(account.deleteAccount,()=>setConfirmDelete(false))}/>
   </View>
  </View>:<Pressable accessibilityRole="button" onPress={()=>setConfirmDelete(true)} style={{paddingVertical:10}}>
   <Text style={[s.muted,{color:C.danger,fontWeight:'600'}]}>{t('Ištrinti paskyrą','Delete account')}</Text>
  </Pressable>}
  {error?<Text accessibilityLiveRegion="polite" style={[s.muted,{color:C.danger}]}>{error}</Text>:null}
 </View>;

 return <View style={{gap:8}}>
  <Text style={s.sectionTitle}>{t('Paskyra (neprivaloma)','Account (optional)')}</Text>
  <Text style={s.muted}>{t('Prisijunkite, kad išsaugoti gyvūnai būtų matomi visuose jūsų įrenginiuose.','Sign in to see your saved animals on all your devices.')}</Text>
  {step==='email'?<>
   <TextInput nativeID="account-email" accessibilityLabel={t('El. paštas','Email')} placeholder={t('jusu@pastas.lt','you@example.com')} placeholderTextColor={C.muted}
    value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="emailAddress" style={s.input}/>
   <Button primary label={t('Gauti prisijungimo kodą','Get a sign-in code')} icon="mail-outline" disabled={busy||!EMAIL.test(email.trim())}
    onPress={()=>run(()=>account.sendCode(email.trim()),()=>setStep('code'))}/>
  </>:<>
   <Text style={s.body}>{t(`Išsiuntėme 6 skaitmenų kodą į ${email.trim()}.`,`We sent a 6-digit code to ${email.trim()}.`)}</Text>
   <TextInput nativeID="account-code" accessibilityLabel={t('Kodas iš laiško','Code from the email')} placeholder="123456" placeholderTextColor={C.muted}
    value={code} onChangeText={v=>setCode(v.replace(/\D/g,'').slice(0,6))} keyboardType="number-pad" textContentType="oneTimeCode" autoComplete="one-time-code" style={[s.input,{letterSpacing:4,fontSize:20}]}/>
   <Button primary label={t('Prisijungti','Sign in')} icon="log-in-outline" disabled={busy||code.length!==6}
    onPress={()=>run(()=>account.verify(email.trim(),code),()=>{setStep('email');setCode('');})}/>
   <Pressable accessibilityRole="button" onPress={()=>{setStep('email');setCode('');setError(null);}} style={{paddingVertical:8}}>
    <Text style={s.more}>{t('Pakeisti el. paštą arba gauti naują kodą','Change email or get a new code')}</Text>
   </Pressable>
  </>}
  {busy?<ActivityIndicator color={C.green}/>:null}
  {error?<Text accessibilityLiveRegion="polite" style={[s.muted,{color:C.danger}]}>{error}</Text>:null}
 </View>;
}
