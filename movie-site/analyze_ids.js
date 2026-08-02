// Script to find which IDs are NOT yet in our catalog
const fs = require('fs');
const src = fs.readFileSync('js/curated.js', 'utf8');

// Extract ALL existing TMDB IDs
const allIds = new Set();

// From ids: [...] patterns
const idSets = src.match(/ids:\s*\[[\d,\s]+\]/g) || [];
idSets.forEach(m => { const nums = m.match(/\d+/g) || []; nums.forEach(n => allIds.add(n)); });

// From INDIVIDUAL_TITLES (name: id pairs)
const re = /"([^"]+)"\s*:\s*(\d+)/g;
let m;
while ((m = re.exec(src)) !== null) {
  allIds.add(m[2]);
}

// From SHOW_DATABASE show entries
const showMatches = src.match(/\{id:\d+/g) || [];
showMatches.forEach(m2 => { const n = m2.match(/\d+/); if (n) allIds.add(n[0]); });

console.log('Total unique IDs currently:', allIds.size);
console.log('Need:', 1100 - allIds.size, 'more');

// Show some IDs that appear multiple times (overlaps)
const idCounts = {};
idSets.forEach(match => {
  const nums = match.match(/\d+/g) || [];
  nums.forEach(n => { idCounts[n] = (idCounts[n] || 0) + 1; });
});

// Check for duplicate TMDB IDs in INDIVIDUAL_TITLES
const titleIds = {};
let m2;
const re2 = /"([^"]+)"\s*:\s*(\d+)/g;
while ((m2 = re2.exec(src)) !== null) {
  titleIds[m2[2]] = (titleIds[m2[2]] || 0) + 1;
}

console.log('\nDuplicate IDs in INDIVIDUAL_TITLES:');
Object.entries(titleIds).filter(([id, count]) => count > 1).forEach(([id, count]) => {
  console.log(`  ID ${id} appears ${count} times`);
});

console.log('\nTotal ID entries in INDIVIDUAL_TITLES:', Object.keys(titleIds).length);
console.log('Unique IDs in INDIVIDUAL_TITLES:', new Set(Object.keys(titleIds)).size);