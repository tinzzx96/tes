const { compareAsync } = require('../src/utils/bcryptPool');
const bcrypt = require('bcryptjs');

async function main() {
  const password = 'siswa123';
  const hash = bcrypt.hashSync(password, 10);
  
  console.log('Testing password verification via Worker Threads Pool...');
  
  // Test correct password
  const t0 = Date.now();
  const isMatchCorrect = await compareAsync(password, hash);
  console.log(`Match correct password: ${isMatchCorrect} (took ${Date.now() - t0}ms)`);

  // Test incorrect password
  const t1 = Date.now();
  const isMatchIncorrect = await compareAsync('wrongpassword', hash);
  console.log(`Match incorrect password: ${isMatchIncorrect} (took ${Date.now() - t1}ms)`);

  // Test concurrent calls
  const promises = [];
  const t2 = Date.now();
  for (let i = 0; i < 20; i++) {
    promises.push(compareAsync(password, hash));
  }
  const results = await Promise.all(promises);
  console.log(`Match concurrent 20 calls: all true? ${results.every(r => r === true)} (took ${Date.now() - t2}ms)`);

  process.exit(0);
}

main().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
