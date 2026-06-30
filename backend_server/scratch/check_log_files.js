const fs = require('fs');

const files = ['logs/combined.log', 'logs/combined1.log', 'logs/combined2.log'];
for (const file of files) {
  if (fs.existsSync(file)) {
    const stats = fs.statSync(file);
    const content = fs.readFileSync(file, 'utf8').trim().split('\n');
    console.log(`=== ${file} ===`);
    console.log(`Size: ${stats.size} bytes`);
    console.log(`Modified: ${stats.mtime.toISOString()}`);
    console.log(`Total lines: ${content.length}`);
    console.log('Last 5 lines:');
    console.log(content.slice(-5).join('\n'));
    console.log('\n');
  }
}
