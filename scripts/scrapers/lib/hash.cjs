'use strict';
const { createHash } = require('node:crypto');
const sha256 = value => createHash('sha256').update(value).digest('hex');
module.exports = { sha256 };
