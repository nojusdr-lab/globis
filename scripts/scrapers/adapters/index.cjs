'use strict';
// Every enabled shelter adapter. One file per website. See sources.json for all sites and why
// some are not here (blocked by robots/terms, no list, Facebook only, site down).
module.exports = [
  require('./kggn.cjs'),
  require('./sos-gyvunai.cjs'),
  require('./katinosvajone.cjs'),
  require('./lese.cjs'),
  require('./mgma.cjs'),
  require('./keturkojodraugas.cjs'),
  require('./penktakoja.cjs'),
  require('./bukmanodraugas.cjs'),
  require('./tautmilesgloba.cjs'),
  require('./siauliuletenele.cjs'),
  require('./mazasdraugas.cjs'),
  require('./linksmosiospedutes.cjs'),
  require('./rozinepedute.cjs'),
  require('./gyvunugloba.cjs'),
  require('./padekman.cjs'),
  require('./beglobis.cjs'),
  require('./naminukai.cjs'),
  require('./keturkojo-viltis.cjs'),
  require('./mazeikiugyvunai.cjs'),
  require('./egzoticsos.cjs'),
];
