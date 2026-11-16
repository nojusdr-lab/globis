const { readFileSync } = require('node:fs');
const columns = ['vmvt_row','registered_name','legal_form_hint','activity_hint','vmvt_status','vmvt_link_label','listed_urls','channel_types','access_gate'];
function parseInventory(text) {
  const [header, ...lines] = text.trimEnd().split(/\r?\n/);
  if (header !== columns.join('\t')) throw Error('Inventory header mismatch');
  const rows = lines.map((line, index) => {
    const fields = line.split('\t');
    if (fields.length !== columns.length) throw Error(`Row ${index+1}: column count`);
    const row = Object.fromEntries(columns.map((key,i) => [key,fields[i]]));
    if (row.vmvt_row !== String(index+1) || !row.registered_name.trim() ||
        !['unknown','inactive','temporarily_not_accepting'].includes(row.vmvt_status)) throw Error(`Row ${index+1}: invalid registry data`);
    const destinations = row.listed_urls ? row.listed_urls.split(' ').map(raw => {
      const url = new URL(raw);
      if (!['http:','https:'].includes(url.protocol) || url.username || url.password) throw Error('Unsafe destination URL');
      const type = url.hostname === 'facebook.com' || url.hostname.endsWith('.facebook.com') ? 'facebook' : 'website';
      return {url:raw,type,accessState:type === 'facebook' ? 'social_authorization_required' : 'website_review_required',dataPermission:'unverified',photoPermission:'unverified'};
    }) : [];
    if (new Set(destinations.map(d=>d.url)).size !== destinations.length || destinations.map(d=>d.type).join(' ') !== row.channel_types) throw Error('Duplicate or mistyped destination');
    const gate = destinations.some(d=>d.type==='website') ? 'website_review_required' : destinations.length ? 'social_authorization_required' : 'no_channel';
    if (row.access_gate !== gate) throw Error('Invalid row access summary');
    return {...row,destinations};
  });
  if (!rows.length) throw Error('Empty inventory');
  return rows;
}
function summarize(rows) {
  const destinations = rows.flatMap(row=>row.destinations);
  return {registryRows:rows.length,rowsWithDestinations:rows.filter(row=>row.destinations.length).length,destinationLinks:destinations.length,uniqueDestinationUrls:new Set(destinations.map(d=>d.url)).size,approvedChannels:0};
}
if (require.main === module) {
  const rows = parseInventory(readFileSync(require('node:path').join(__dirname,'../../docs/discovery-engine/vmvt-guardian-inventory.tsv'),'utf8'));
  console.log(JSON.stringify({summary:summarize(rows),rows},null,2));
}
module.exports={parseInventory,summarize};
