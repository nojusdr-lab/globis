const {test}=require('node:test');const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');
const root=path.join(__dirname,'..');
const meta=JSON.parse(fs.readFileSync(path.join(root,'store/metadata.json'),'utf8'));
const app=JSON.parse(fs.readFileSync(path.join(root,'app.json'),'utf8')).expo;
const len=s=>[...s].length;
const banned=/\b(android|google play|iphone|ipad|app store|best|free)\b|#1|nemokam|geriausi/i;
test('Apple listing fields fit App Store Connect limits',()=>{
 for(const [loc,m] of Object.entries(meta.apple.locales)){
  assert.ok(len(m.name)<=30,`${loc} name`);
  assert.ok(len(m.subtitle)<=30,`${loc} subtitle`);
  assert.ok(len(m.promotionalText)<=170,`${loc} promo ${len(m.promotionalText)}`);
  assert.ok(len(m.description)<=4000,`${loc} description`);
  assert.ok(Buffer.byteLength(m.keywords,'utf8')<=100,`${loc} keywords ${Buffer.byteLength(m.keywords)} bytes`);
  assert.doesNotMatch(m.keywords,/, | ,/,`${loc} keywords must not have spaces around commas`);
  const kw=m.keywords.toLowerCase().split(',');
  assert.equal(new Set(kw).size,kw.length,`${loc} duplicate keyword`);
  assert.ok(!kw.includes(m.name.toLowerCase()),`${loc} app name repeated in keywords`);
  for(const f of ['subtitle','promotionalText','description'])assert.doesNotMatch(m[f],banned,`${loc} ${f} has store/superlative term`);
 }
});
test('Google Play listing fields fit Play Console limits',()=>{
 for(const [loc,m] of Object.entries(meta.google.locales)){
  assert.ok(len(m.title)<=30,`${loc} title ${len(m.title)}`);
  assert.ok(len(m.shortDescription)<=80,`${loc} short ${len(m.shortDescription)}`);
  assert.ok(len(m.fullDescription)<=4000,`${loc} full`);
  for(const f of ['title','shortDescription','fullDescription'])assert.doesNotMatch(m[f],banned,`${loc} ${f} has store/superlative term`);
 }
 assert.ok(meta.google.locales['lt-LT'],'Lithuanian Play listing exists');
});
test('listing makes no numeric claims that data could contradict',()=>{
 const all=JSON.stringify(meta.apple.locales)+JSON.stringify(meta.google.locales);
 assert.doesNotMatch(all,/\d{2,}\s*(\+|pets|gyvūn|shelters|prieglaud)/i);
});
test('store config: assets exist, no fake contacts, privacy manifest present',()=>{
 for(const p of [app.icon,app.ios.icon,app.android.adaptiveIcon.foregroundImage,app.android.adaptiveIcon.monochromeImage,app.web.favicon])
  assert.ok(fs.existsSync(path.join(root,p)),p);
 const splash=app.plugins.find(p=>Array.isArray(p)&&p[0]==='expo-splash-screen');
 assert.ok(splash&&fs.existsSync(path.join(root,splash[1].image)),'splash image');
 assert.equal(app.ios.privacyManifests.NSPrivacyTracking,false);
 assert.deepEqual(app.ios.privacyManifests.NSPrivacyCollectedDataTypes,[]);
 assert.equal(app.ios.config.usesNonExemptEncryption,false);
 assert.deepEqual(app.android.permissions,['INTERNET']);
 // Contacts stay null until the owner provides real ones.
 for(const k of ['supportEmail','privacyPolicyUrl'])
  assert.ok(app.extra[k]===null||/^(https:\/\/|[^@\s]+@[^@\s]+\.[a-z]{2,}$)/i.test(app.extra[k]),k);
 const eas=JSON.parse(fs.readFileSync(path.join(root,'eas.json'),'utf8'));
 assert.equal(eas.cli.appVersionSource,'remote');
 assert.ok(!JSON.stringify(eas).match(/serviceAccountKey|appleId|ascAppId|password|token/i),'no credentials in eas.json');
});
