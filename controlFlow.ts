export namespace ControlFlow {
    // any async function
    export type Callback = (...args: any[]) => Promise<any>;

    // an async function that runs callbacks
    export type Scheduler = (callbacks: readonly Callback[], concurrency?: number) => Promise<any[]>;

    // issue callbacks serially, one at a time
    export async function serial(callbacks: readonly Callback[]) {
        let results: any[] = [];
        for (let cb of callbacks) {
            results.push(await cb());
        }
        return results;
    }

    // issue all callbacks at once
    export async function allAtOnce(callbacks: readonly Callback[]) {
        return Promise.all(callbacks.map((cb) => cb()));
    }

    // issue callbacks in batches of the given concurrency at a time.
    // start the next batch when all callbacks in the previous batch complete
    export async function batchConcurrency(callbacks: readonly Callback[], concurrency: number = 4) {
        let start = 0;
        let results: any[] = [];
        while (start < callbacks.length) {
            let batch = callbacks.slice(start, start + concurrency);
            results = results.concat(await allAtOnce(batch));
            start += concurrency;
        }
        return results;
    }

    // issue callbacks continuously, no more than the the concurrency limit at a time
    // starts one callback after a previous callback completes
    export async function continuousConcurrency(callbacks: readonly Callback[], concurrency: number = 4) {
        return new Promise((resolve) => {
            let results = new Array(callbacks.length);
            // index of next callback to invoke
            let next = 0;
            // count of callbacks that have completed
            let completed = 0;

            // invoke the next callback and wrap it with our success handler which determines the next action
            let invokeNext = () => {
                let idx = next;
                let cb = callbacks[next++];
                cb().then((result) => onSuccess(idx, result));
            };

            // when a promise completes successfully, resovle if done or queue up another if needed
            let onSuccess = (index: number, result: any) => {
                completed++;
                results[index] = result;
                if (next < callbacks.length) {
                    invokeNext();
                } else if (completed == callbacks.length) {
                    resolve(results);
                }
            };

            // invoke the first set of callbacks
            [...Array(Math.min(concurrency, callbacks.length))].map(invokeNext);
        });
    }
}
