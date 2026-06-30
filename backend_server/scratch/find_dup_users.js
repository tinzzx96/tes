const fs = require('fs');
const content = fs.readFileSync('users.csv', 'utf8');
const lines = content.trim().split('\n').slice(1); // skip header

const nisns = lines.map(line => line.split(',')[0].trim());
const uniqNisns = new Set(nisns);

console.log('Total lines in CSV:', lines.length);
console.log('Total unique NISNs:', uniqNisns.size);

const dups = {};
for (const nisn of nisns) {
  dups[nisn] = (dups[nisn] || 0) + 1;
}

const dupEntries = Object.entries(dups).filter(([k, v]) => v > 1);
console.log('Duplicate NISNs count:', dupEntries.length);
if (dupEntries.length > 0) {
  console.log('First 5 duplicates:', dupEntries.slice(0, 5));
}
