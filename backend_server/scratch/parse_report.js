const fs = require('fs');
const report = JSON.parse(fs.readFileSync('report.json', 'utf8'));

console.log('Errors:');
console.log(JSON.stringify(report.aggregate.errors, null, 2));

console.log('HTTP codes:');
console.log(JSON.stringify(report.aggregate.codes, null, 2));

console.log('Scenarios created:', report.aggregate.scenariosCreated);
console.log('Scenarios avoided:', report.aggregate.scenariosAvoided);
console.log('Scenarios completed:', report.aggregate.scenariosCompleted);
console.log('Pending scenarios:', report.aggregate.pendingScenarios);
