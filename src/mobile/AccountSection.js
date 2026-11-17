// Optional sign-in with email and password; a forgotten password is reset with an emailed code. Browsing and saving never need it.
import React,{useState} from 'react';
import {View,Text,TextInput,Pressable,ActivityIndicator} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {Button} from './ui';
import {C,styles as s} from './theme';

const EMAIL=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function AccountSection({account,lang}) {
 const t=(lt,en)=>lang==='lt'?lt:en;
 const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[code,setCode]=useState(''),[step,setStep]=useState('signin');
 const [busy,setBusy]=useState(false),[error,setError]=useState(null),[confirmDelete,setConfirmDelete]=useState(false);
 if(!account.available) return null;

 const run=async(fn,next)=>{
  setBusy(true);setError(null);
  try{const {error:e}=await fn();if(e)throw e;next?.();}
  catch(e){setError(e?.status===429||/rate/i.test(e?.message||'')
   ?t('Per daug bandymų. Palaukite kelias minutes ir bandykite vėl.','Too many attempts. Wait a few minutes and try again.')
   :/invalid login/i.test(e?.message||'')?t('Neteisingas el. paštas arba slaptažodis.','Wrong email or password.')
   :/already registered/i.test(e?.message||'')?t('Šis el. paštas jau turi paskyrą. Prisijunkite.','This email already has an account. Sign in.')
   :step==='resetCode'?t('Kodas netinka arba nebegalioja. Gaukite naują.','The code is wrong or expired. Request a new one.')
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

 const ok=EMAIL.test(email.trim()),pwOk=password.length>=8;
 const field=(id,label,value,set,extra)=><TextInput nativeID={id} accessibilityLabel={label} placeholder={label} placeholderTextColor={C.muted} value={value} onChangeText={set} autoCapitalize="none" style={s.input} {...extra}/>;
 const emailField=field('account-email',t('El. paštas','Email'),email,setEmail,{autoComplete:'email',keyboardType:'email-address',textContentType:'emailAddress'});
 const pwField=(label,newPw)=>field('account-password',label,password,setPassword,{secureTextEntry:true,autoComplete:newPw?'new-password':'current-password',textContentType:newPw?'newPassword':'password'});
 const link=(label,next)=><Pressable accessibilityRole="button" onPress={()=>{setStep(next);setError(null);setCode('');}} style={{paddingVertical:8}}><Text style={s.more}>{label}</Text></Pressable>;
 const pwHint=<Text style={s.muted}>{t('Bent 8 simboliai.','At least 8 characters.')}</Text>;
 return <View style={{gap:8}}>
  <Text style={s.sectionTitle}>{t('Paskyra (neprivaloma)','Account (optional)')}</Text>
  <Text style={s.muted}>{t('Prisijunkite, kad išsaugoti gyvūnai būtų matomi visuose jūsų įrenginiuose.','Sign in to see your saved animals on all your devices.')}</Text>
  {step==='signin'?<>
   {emailField}{pwField(t('Slaptažodis','Password'),false)}
   <Button primary label={t('Prisijungti','Sign in')} icon="log-in-outline" disabled={busy||!ok||!password} onPress={()=>run(()=>account.signIn(email.trim(),password),()=>setPassword(''))}/>
   {link(t('Neturite paskyros? Susikurkite','No account? Create one'),'signup')}
   {link(t('Pamiršau slaptažodį','Forgot password'),'reset')}
  </>:step==='signup'?<>
   {emailField}{pwField(t('Naujas slaptažodis','New password'),true)}{pwHint}
   <Button primary label={t('Sukurti paskyrą','Create account')} icon="person-add-outline" disabled={busy||!ok||!pwOk} onPress={()=>run(()=>account.signUp(email.trim(),password),()=>setPassword(''))}/>
   {link(t('Jau turite paskyrą? Prisijunkite','Have an account? Sign in'),'signin')}
  </>:step==='reset'?<>
   {emailField}
   <Button primary label={t('Siųsti kodą','Send code')} icon="mail-outline" disabled={busy||!ok} onPress={()=>run(()=>account.sendReset(email.trim()),()=>setStep('resetCode'))}/>
   {link(t('Atgal','Back'),'signin')}
  </>:<>
   <Text style={s.body}>{t(`Jei ${email.trim()} turi paskyrą, išsiuntėme 6 skaitmenų kodą.`,`If ${email.trim()} has an account, we sent a 6-digit code.`)}</Text>
   {field('account-code',t('Kodas iš laiško','Code from the email'),code,v=>setCode(v.replace(/\D/g,'').slice(0,6)),{keyboardType:'number-pad',textContentType:'oneTimeCode',autoComplete:'one-time-code'})}
   {pwField(t('Naujas slaptažodis','New password'),true)}{pwHint}
   <Button primary label={t('Pakeisti slaptažodį','Change password')} icon="key-outline" disabled={busy||code.length!==6||!pwOk} onPress={()=>run(()=>account.resetWithCode(email.trim(),code,password),()=>{setPassword('');setCode('');setStep('signin');})}/>
   {link(t('Atgal','Back'),'signin')}
  </>}
  {busy?<ActivityIndicator color={C.green}/>:null}
  {error?<Text accessibilityLiveRegion="polite" style={[s.muted,{color:C.danger}]}>{error}</Text>:null}
 </View>;
}
