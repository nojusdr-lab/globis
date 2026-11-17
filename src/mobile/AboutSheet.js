import React from 'react';
import {Text,View} from 'react-native';
import {SourceLink} from './ui';
import {styles as s} from './theme';
import {email} from '../data/integrity.cjs';
import {expo as config} from '../../app.json';
export default function AboutSection({lang='lt'}) {
 const t=(lt,en)=>lang==='lt'?lt:en;
 const support=email(config.extra?.supportEmail);
 return <View style={{gap:8}}>
 <Text style={s.sectionTitle}>{t('Apie GLOBIS','About GLOBIS')}</Text>
 <Text style={s.title}>GLOBIS · {t('versija','version')} {config.version}</Text>
 <Text style={s.body}>{t('Išsaugoti ir praleisti skelbimai bei kalba laikomi šiame įrenginyje. Paskyra nekuriama. Pasirinkimai tarp įrenginių nesinchronizuojami.','Saved and skipped listings and your language are kept on this device. No account is created. Choices are not synced between devices.')}</Text>
 <Text style={s.body}>{t('Išvalius programėlės ar naršyklės svetainės duomenis pasirinkimai pašalinami. Išorinės gyvūnų nuotraukos ir atidarytos šaltinio nuorodos gali perduoti techninius ryšio duomenis tų svetainių valdytojams.','Clearing the app or browser site data removes your choices. External animal photos and opened source links may share technical connection data with the operators of those websites.')}</Text>
 <Text style={s.body}>{t('Skelbimų prieinamumą ir visus nežinomus duomenis patikslinkite tiesiogiai su prieglauda. GLOBIS nesiunčia įvaikinimo paraiškų.','Confirm availability and any unknown details directly with the shelter. GLOBIS does not send adoption applications.')}</Text>
 <Text style={s.title}>{t('Palaikymas','Support')}</Text>
 <Text selectable style={s.body}>{support||t('Palaikymo kontaktas dar nepaskelbtas.','A support contact has not been published yet.')}</Text>
 </View>;
}
