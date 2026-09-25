// node tools/release.js [patch|minor|major]
// Bumps the version, writes it into the service worker's cache name (installed players only get a new build when
// sw.js changes), refuses to ship leftover placeholders, runs the tests, and prints the git commands to tag and push.
'use strict';
const fs = require('fs'), path = require('path'), cp = require('child_process');
const root = path.join(__dirname, '..');
const pkgPath = path.join(root, 'package.json'), pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const part = process.argv[2] || 'patch';
let [ma, mi, pa] = pkg.version.split('.').map(Number);
if (part === 'major') { ma++; mi = 0; pa = 0; } else if (part === 'minor') { mi++; pa = 0; } else pa++;
const version = `${ma}.${mi}.${pa}`;

const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const problems = [];
if (/orbfall\.example/.test(html)) problems.push('index.html still has the placeholder domain in its og:url / og:image tags; put your real address there (see PUBLISHING.md)');
if (problems.length) { console.error('Not releasing:\n  - ' + problems.join('\n  - ')); process.exit(1); }

pkg.version = version; fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
const swPath = path.join(root, 'sw.js'); let sw = fs.readFileSync(swPath, 'utf8');
if (!/var CACHE='[^']*';/.test(sw)) { console.error('sw.js: could not find the CACHE line'); process.exit(1); }
sw = sw.replace(/var CACHE='[^']*';/, `var CACHE='orbfall-shell-${version}';`); fs.writeFileSync(swPath, sw);
console.log(`version ${version}; cache name orbfall-shell-${version}; running the tests...`);

const r = cp.spawnSync('npm test', { cwd: root, stdio: 'inherit', shell: true });
if (r.status !== 0) { console.error('\nTests failed. The version bump is written but nothing is committed; fix, then run the release again.'); process.exit(1); }
console.log(`\nReady to ship ${version}. Now run:\n  git add -A\n  git commit -m "Release ${version}"\n  git tag v${version}\n  git push && git push --tags`);
