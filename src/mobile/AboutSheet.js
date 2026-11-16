import React from 'react';
import {Text} from 'react-native';
import {Sheet,SourceLink} from './ui';
import {styles as s} from './theme';
import {email} from '../data/integrity.cjs';
import {expo as config} from '../../app.json';
export default function AboutSheet({onClose,reduced}) {
 const support=email(config.extra?.supportEmail);
 return <Sheet title="Apie GLOBIS" onClose={onClose} reduced={reduced}>
 <Text style={s.title}>GLOBIS · {config.version} beta</Text>
 <Text style={s.body}>Išsaugoti ir praleisti skelbimai bei kalba laikomi šiame įrenginyje. Paskyra nekuriama. Pasirinkimai tarp įrenginių nesinchronizuojami.</Text>
 <Text style={s.body}>Išvalius programėlės ar naršyklės svetainės duomenis pasirinkimai pašalinami. Išorinės gyvūnų nuotraukos ir atidarytos šaltinio nuorodos gali perduoti techninius ryšio duomenis tų svetainių valdytojams.</Text>
 <Text style={s.body}>Skelbimų prieinamumą ir visus nežinomus duomenis patikslinkite tiesiogiai su prieglauda. GLOBIS nesiunčia įvaikinimo paraiškų.</Text>
 <Text style={s.title}>Palaikymas</Text>
 <Text selectable style={s.body}>{support||'Palaikymo kontaktas dar nepaskelbtas.'}</Text>
 <SourceLink url={config.extra?.privacyPolicyUrl} label="Privatumo politika"/>
 {!config.extra?.privacyPolicyUrl?<Text style={s.muted}>Vieša privatumo politikos nuoroda dar nepaskelbta. Beta nepaskelbta parduotuvėse.</Text>:null}
 </Sheet>;
}
