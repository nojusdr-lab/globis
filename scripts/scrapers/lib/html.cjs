'use strict';
// Small helpers around cheerio for HTML adapters.
const cheerio = require('cheerio');
const N = require('./normalize.cjs');

function load(html) { return cheerio.load(html); }

function abs(href, base) {
  try { return new URL(href, base).href; } catch { return null; }
}

// [label, value] pairs from <table> rows (th/td or td/td) and <dl> lists inside $root.
function pairs($, root) {
  const out = [];
  $(root).find('tr').each((_, tr) => {
    const cells = $(tr).children('th,td');
    if (cells.length >= 2) out.push([N.cleanText($(cells[0]).text()), N.cleanText($(cells[1]).text())]);
  });
  $(root).find('dt').each((_, dt) => out.push([N.cleanText($(dt).text()), N.cleanText($(dt).next('dd').text())]));
  return out.filter(([a, b]) => a && b);
}

// Image URL of an <img>, preferring lazy-load attributes over placeholders.
function imgSrc($img, base) {
  const src = $img.attr('data-src') || $img.attr('data-lazy-src') || $img.attr('src');
  if (!src || src.startsWith('data:')) return null;
  return abs(src, base);
}

module.exports = { load, abs, pairs, imgSrc };
