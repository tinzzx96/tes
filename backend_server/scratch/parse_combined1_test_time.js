const fs = require('fs');
const readline = require('readline');

async function main() {
  const fileStream = fs.createReadStream('logs/combined1.log');
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  const matchingLogs = [];
  for await (const line of rl) {
    // Check if timestamp contains 14:09 or 14:10 in UTC (which is 21:09 or 21:10)
    if (line.includes('29/Jun/2026:14:09') || line.includes('29/Jun/2026:14:10')) {
      if (line.includes('422')) {
        matchingLogs.push(line);
      }
    }
  }

  console.log(`Found ${matchingLogs.length} 422 logs in combined1.log during test time:`);
  console.log('First 20 matching logs:');
  console.log(matchingLogs.slice(0, 20).join('\n'));
}

main();
