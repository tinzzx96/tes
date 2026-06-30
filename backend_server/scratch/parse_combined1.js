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
    if (line.includes('422')) {
      matchingLogs.push(line);
    }
  }

  console.log(`Found ${matchingLogs.length} 422 logs in combined1.log:`);
  console.log('First 20 matching logs:');
  console.log(matchingLogs.slice(0, 20).join('\n'));
}

main();
