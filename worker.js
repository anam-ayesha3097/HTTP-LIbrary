
const {exec} = require("child_process");
const { parentPort, workerData } = require('worker_threads');

exec(`node httpfs ${workerData}`, (error, stdout, stderr) => {
    if (error) {
        console.log(`error: ${error.message}`);
        return;
    }
    if (stderr) {
        console.log(`stderr: ${stderr}`);
        return;
    }
    parentPort.postMessage(stdout);
    process.exit(1);
});