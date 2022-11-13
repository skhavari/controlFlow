import * as fs from 'fs';
import { ControlFlow } from './controlFlow';

const files = ['./test.json', './memories-icon.svg'];
const sites = ['https://maps.snapchat.com', 'https://www.snapchat.com/discover', 'https://lens.snapchat.com/'];

const loadFile = async (filename: string) =>
    new Promise((resolve, reject) => {
        fs.readFile(filename, 'utf-8', (err, data) => (err ? reject(err) : resolve(data)));
    });

const loadSite = async (url: string) => {
    let response = await fetch(url);
    return response.text();
};

const randomInt = (max: number) => Math.floor(Math.random() * (max + 1));

const createTasks = (n: number) =>
    [...Array(n)].map((_) => {
        let isFile = randomInt(1) === 0;
        let [fn, arg] = isFile ? [loadFile, files[randomInt(files.length - 1)]] : [loadSite, sites[randomInt(sites.length - 1)]];
        return () => fn(arg);
    });

const run = async () => {
    const nTasks = 128;
    let tasks = createTasks(nTasks);

    for (let concurrency = nTasks; concurrency >= 4; concurrency /= 2) {
        let start = Date.now();
        let result = await ControlFlow.continuousConcurrency(tasks, concurrency);
        let end = Date.now();
        console.log(`Completed ${nTasks} tasks in ${end - start} millis with concurrency level ${concurrency}`);
    }
};

run();
