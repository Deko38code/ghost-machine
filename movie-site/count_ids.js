const fs = require('fs');
const src = fs.readFileSync('js/curated.js', 'utf8');
const allIds = new Set();
const idSets = src.match(/ids:\s*\[[\d,\s]+\]/g) || [];
idSets.forEach(m => { const nums = m.match(/\d+/g) || []; nums.forEach(n => allIds.add(n)); });
const re = /"([^"]+)"\s*:\s*(\d+)/g;
let m;
while ((m = re.exec(src)) !== null) allIds.add(m[2]);
const showMatches = src.match(/\{id:\d+/g) || [];
showMatches.forEach(m2 => { const n = m2.match(/\d+/); if (n) allIds.add(n[0]); });
console.log('Current unique IDs:', allIds.size);
console.log('Need:', 1100 - allIds.size, 'more');
// Output IDs as array for checking
const sorted = [...allIds].map(Number).sort((a,b) => a-b);
console.log('ID range:', sorted[0], '-', sorted[sorted.length-1]);