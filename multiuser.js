const { Worker } = require('worker_threads');

for(let i=2; i<process.argv.length; i++){
    const worker = new Worker('./worker.js', {
        workerData: process.argv[i]
    });

    worker.once('message', (msg) => {
        console.log("Received message from thread:\n ",msg);
    });
}
