const fs = require('fs');
const readline = require('readline');

async function main() {
  const fileStream = fs.createReadStream('logs/combined.log');
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  const matchingLogs = [];
  for await (const line of rl) {
    // Look for logs from 21:09 to 21:12
    if (line.includes('2026-06-29 21:09') || line.includes('2026-06-29 21:10') || line.includes('2026-06-29 21:11')) {
      if (line.includes('422')) {
        matchingLogs.push(line);
      }
    }
  }

  console.log(`Found ${matchingLogs.length} 422 logs:`);
  console.log(matchingLogs.slice(0, 50).join('\n'));
}

main();
