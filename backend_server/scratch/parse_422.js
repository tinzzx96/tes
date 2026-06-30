const fs = require('fs');
const readline = require('readline');

async function main() {
  const fileStream = fs.createReadStream('logs/combined.log');
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  const codes422 = [];
  for await (const line of rl) {
    if (line.includes('"POST /api/exam-tokens/validate HTTP/1.1" 422')) {
      codes422.push(line);
      if (codes422.length >= 10) break;
    }
  }

  console.log('422 Logs:', codes422);
}

main();
