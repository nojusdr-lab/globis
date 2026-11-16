# GLOBIS privatumo informacija — beta projektas

Tai įgyvendintos beta elgsenos aprašymas, dar ne savininko patvirtinta vieša privatumo politika. Duomenų valdytojo juridinis pavadinimas, palaikymo / privatumo kontaktas ir viešas politikos URL turi būti pateikti prieš platinimą. Nė vienas kontaktas neišgalvotas.

- Programėlė šiame etape neregistruoja paskyrų, nesiunčia įvaikinimo paraiškų ir neturi pridėtos serverinės pasirinkimų sinchronizacijos ar analitikos.
- Išsaugotų / praleistų skelbimų ID, iki 100 atšaukimo įvykių ir kalba laikomi vietoje. Web naudoja naršyklės localStorage; native – Expo SQLite kv-store. Šie duomenys laikomi iki programėlės / svetainės duomenų išvalymo. Įrenginio atsarginės kopijos priklauso nuo OS nustatymų.
- Nuotraukos kraunamos iš istorinių skelbimų URL; tinklo užklausa gali atskleisti IP ir techninius ryšio duomenis nuotraukų serveriui. Originalaus skelbimo atidarymas perduoda naršymą trečiosios šalies svetainei ir jos taisyklėms.
- Skambučio, el. pašto ir dalijimosi veiksmai perduodami įrenginio programėlėms. Šioje kopijoje patvirtintų telefono / el. pašto kontaktų nėra; rodoma šaltinio nuoroda. GLOBIS nepatvirtina paraiškos gavimo ar įvaikinimo.
- Norint ištrinti vietinius pasirinkimus, išvalyti GLOBIS programėlės arba naršyklės svetainės duomenis. Pašalinus vieną gyvūną iš Išsaugoti, jo ID pašalinamas iš išsaugotų pasirinkimų ir atšaukimo istorija išvaloma.

Prieš atveriant išorinį beta kanalą būtina savininko peržiūra: duomenų valdytojas ir kontaktas, šaltinių / nuotraukų teisės, saugojimo ir vartotojo teisių informacija, store privatumo formos bei tikras tinklo elgesys fiziniuose įrenginiuose. Bet kuri nauja paskyrų, serverio, analitikos ar AI integracija reikalauja naujo šio aprašo vertinimo.
