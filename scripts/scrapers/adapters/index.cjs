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
  require('./mazijausmai.cjs'),
];
