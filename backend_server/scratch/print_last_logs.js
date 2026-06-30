const fs = require('fs');

const content = fs.readFileSync('logs/combined.log', 'utf8');
const lines = content.trim().split('\n');
console.log('Total log lines:', lines.length);
console.log('Last 20 log lines:');
console.log(lines.slice(-20).join('\n'));
