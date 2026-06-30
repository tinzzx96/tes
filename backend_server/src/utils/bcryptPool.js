const { Worker } = require('worker_threads');
const path = require('path');
const os = require('os');

const MAX_WORKERS = Math.max(1, Math.min(4, os.cpus().length || 1));
const workers = [];
const queue = [];

function createWorker() {
  const workerPath = path.join(__dirname, '../workers/bcrypt.worker.js');
  const worker = new Worker(workerPath);
  
  const workerInfo = {
    worker,
    busy: false,
    activeTask: null
  };

  worker.on('message', (result) => {
    const { id, isMatch, error } = result;
    const task = workerInfo.activeTask;
    workerInfo.activeTask = null;
    workerInfo.busy = false;

    if (task && task.id === id) {
      if (error) {
        task.reject(new Error(error));
      } else {
        task.resolve(isMatch);
      }
    }
    
    // Process next item in queue
    processQueue();
  });

  worker.on('error', (err) => {
    console.error('[BcryptWorker] Error:', err);
    const task = workerInfo.activeTask;
    workerInfo.activeTask = null;
    workerInfo.busy = false;
    if (task) {
      task.reject(err);
    }
    
    // Replace dead worker
    const index = workers.indexOf(workerInfo);
    if (index !== -1) {
      workers.splice(index, 1);
    }
    createWorker();
  });

  workers.push(workerInfo);
}

function processQueue() {
  if (queue.length === 0) return;

  const idleWorker = workers.find(w => !w.busy);
  if (!idleWorker) return;

  const task = queue.shift();
  idleWorker.busy = true;
  idleWorker.activeTask = task;
  idleWorker.worker.postMessage({
    id: task.id,
    password: task.password,
    hash: task.hash
  });
}

// Initialize pool
for (let i = 0; i < MAX_WORKERS; i++) {
  createWorker();
}

let taskIdCounter = 0;

function compareAsync(password, hash) {
  return new Promise((resolve, reject) => {
    const id = taskIdCounter++;
    queue.push({ id, password, hash, resolve, reject });
    processQueue();
  });
}

module.exports = { compareAsync };
