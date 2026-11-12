// node tools/blockcheck.js [files...]      (npm run blockcheck)
// Would a content blocker hide part of the game? Blockers hide page elements by id and class name, and the common
// lists carry thousands of generic names. EasyList hides #adbox, which used to be the game's own reward dialog: for
// every player with a blocker the dialog was invisible and the game sat paused behind it. This reads index.html and
// privacy.html, collects every id and class (markup and script), and tests each against the generic hiding rules of
// the common lists. It needs the network, so it is not part of npm test; run it after adding or renaming elements.
// test/pwa.js keeps an offline guard: no id or class may start with ad, share, social, banner, sponsor or promo.
'use strict';
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const files = process.argv.slice(2).length ? process.argv.slice(2) : ['index.html', 'privacy.html'].map(f => path.join(root, f));
const LISTS = {
  'EasyList (default in uBlock Origin, AdNauseam, Adblock Plus, Brave)': 'https://raw.githubusercontent.com/easylist/easylist/master/easylist/easylist_general_hide.txt',
  'AdGuard Base': 'https://raw.githubusercontent.com/AdguardTeam/AdguardFilters/master/BaseFilter/sections/general_elemhide.txt',
  'AdGuard Mobile ads': 'https://raw.githubusercontent.com/AdguardTeam/AdguardFilters/master/MobileFilter/sections/general_elemhide.txt',
  'AdGuard Social': 'https://raw.githubusercontent.com/AdguardTeam/AdguardFilters/master/SocialFilter/sections/general_elemhide.txt',
  'Fanboy Social': 'https://raw.githubusercontent.com/easylist/easylist/master/fanboy-addon/fanboy_social_general_hide.txt',
  'Fanboy Annoyances': 'https://raw.githubusercontent.com/easylist/easylist/master/fanboy-addon/fanboy_annoyance_general_hide.txt',
  'Fanboy Notifications': 'https://raw.githubusercontent.com/easylist/easylist/master/fanboy-addon/fanboy_notifications_general_hide.txt',
  'Fanboy Newsletter': 'https://raw.githubusercontent.com/easylist/easylist/master/fanboy-addon/fanboy_newsletter_general_hide.txt',
  'EasyList Cookie': 'https://raw.githubusercontent.com/easylist/easylist/master/easylist_cookie/easylist_cookie_general_hide.txt'
};
function tokens(src) {
  const ids = new Set(), classes = new Set(), add = (set, list) => list.split(/\s+/).filter(Boolean).forEach(c => set.add(c));
  for (const m of src.matchAll(/\bid=\\?"([^"\\]+)\\?"/g)) ids.add(m[1]);
  for (const m of src.matchAll(/\bclass=\\?"([^"\\]+)\\?"/g)) add(classes, m[1]);
  for (const m of src.matchAll(/classList\.(?:add|remove|toggle|contains)\('([^']+)'/g)) classes.add(m[1]);
  for (const m of src.matchAll(/className\s*=\s*'([^']+)'/g)) add(classes, m[1]);
  return { ids, classes };
}
module.exports = { tokens };
if (require.main === module) (async () => {
  const ids = new Set(), classes = new Set();
  for (const f of files) { const t = tokens(fs.readFileSync(f, 'utf8')); t.ids.forEach(x => ids.add(x)); t.classes.forEach(x => classes.add(x)); }
  console.log(ids.size + ' ids and ' + classes.size + ' classes in ' + files.map(f => path.basename(f)).join(', '));
  let total = 0, read = 0;
  for (const [name, url] of Object.entries(LISTS)) {
    let text; try { const r = await fetch(url); if (!r.ok) { console.log('  skip ' + name + ' (http ' + r.status + ')'); continue; } text = await r.text(); } catch (e) { console.log('  skip ' + name + ' (' + e.message + ')'); continue; }
    read++;
    const rules = new Set(text.split(/\r?\n/).filter(l => l.startsWith('##')).map(l => l.slice(2).trim()));
    const hits = [];
    ids.forEach(i => { if (rules.has('#' + i)) hits.push('#' + i); });
    classes.forEach(c => { if (rules.has('.' + c)) hits.push('.' + c); });
    total += hits.length;
    console.log((hits.length ? '  HIT  ' : '  ok   ') + name + ', ' + rules.size + ' generic rules' + (hits.length ? ': ' + hits.join(' ') : ''));
  }
  if (!read) { console.error('No list could be read; check the network.'); process.exit(2); }
  if (total) { console.error(total + ' name(s) a blocker would hide. Rename them.'); process.exit(1); }
  console.log('Nothing in the game is hidden by these lists.');
})();
