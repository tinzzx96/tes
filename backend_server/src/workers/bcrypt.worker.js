const { parentPort } = require('worker_threads');
const bcrypt = require('bcryptjs');

parentPort.on('message', (data) => {
  const { id, password, hash } = data;
  try {
    const isMatch = bcrypt.compareSync(password, hash);
    parentPort.postMessage({ id, isMatch });
  } catch (err) {
    parentPort.postMessage({ id, error: err.message });
  }
});
