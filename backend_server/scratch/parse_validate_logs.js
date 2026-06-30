const fs = require('fs');
const readline = require('readline');

async function main() {
  const fileStream = fs.createReadStream('logs/combined.log');
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  const logs = [];
  for await (const line of rl) {
    if (line.includes('validate')) {
      logs.push(line);
      if (logs.length >= 15) break;
    }
  }

  console.log('Validate Logs:', logs);
}

main();
