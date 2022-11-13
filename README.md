# Concurrency in TypeScript

## Overview
If you construct software for any sizable application, at some point you'll need to tune how various tasks execute. If  you develop an internet browser the workflow of visiting a page is a highly tuned workflow where steps of that workflow run serially and some "at the same time". You'll face this balance of serial or "at the same time" if you work on messaging applications, email applications, games, news readers and more.
The following source code snippets demonstrate several concurrency modes in TypeScript, highlighting its simplicity. There are plenty of free open source libraries out you can leverage for solutions to concurrency control flow. I looked at several and most were bloated from an app size perspective and implementation complexity perspective, so I wrote my own. Below highlights examples of control flow only and not meant to be drop in solutions for your production application, which needs error handling, observability and more features for the caller, like support for termination.

## Quick Setup
To take advantage of TypeScripts main value prop, type safety, the following pre-requisite types are defined. The first defines a Callback as an asynchronous function that takes any number of parameters and returns a promise that completes with and array of elements of any type (lots of room for improvement here, eg, Generics). 
type Callback = (...args: any[]) => Promise<any[]>;
The second defines a Schedule function as a function that takes an array of callbacks and an optional concurrency level and returns a promise that completes with the results of those callbacks.
type Scheduler = (callbacks: readonly Callback[], concurrency?: number) => Promise<any[]>;
With these lets define a few Schedulers that issue Callbacks serially, all at once, in batches or continuously.

## Serial 
This one is quite simple, run a callback waiting for it to complete, then another and so on.
```typescript
async function serial(callbacks: readonly Callback[]) {
    let results: any[] = [];
    for (let cb of callbacks) {
        results.push(await cb());
    }
    return results;
}
```

## All At Once
Another simple one, this scheduler issues all callbacks at the same time.
```typescript
export async function allAtOnce(callbacks: readonly Callback[]) {
    return Promise.all(callbacks.map((cb) => cb()));
}
```

## Batched Concurrency
You might occasionally want run callbacks in serial, and when there are few, all at once, but almost always you want to more control over how many run. In this mode, you issue callbacks in batches and only run the next batch after the previous batch is completed.
```typescript
async function batchConcurrency(callbacks: readonly Callback[], concurrency: number = 4) {
    let start = 0;
    let results: any[] = [];
    while (start < callbacks.length) {
        let batch = callbacks.slice(start, start + concurrency);
        results = results.concat(await allAtOnce(batch));
        start += concurrency;
    }
    return results;
}
```

## Continuous Concurrency
Batched is nice, but one long task in the batch hampers latency. It would be nicer to specify a concurrency level and issue that many callbacks, and make sure that number of callbacks are always outstanding. This is exactly what the following provides. It issues the right number of callbacks, and whenever one completes it issues another until all are done. I've seen several implementations of the following, and surprised at the complexity in some of those implementations. Something like this works just fine.
```typescript
async function continuousConcurrency(callbacks: readonly Callback[], concurrency: number = 4) {
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
```

## Extra Credit
When you have a set of tasks, often all tasks aren't created equal. You could easily create an optimizer that takes in a set of tasks and outputs a set of callbacks in a more optimal order that one of these schedulers can then execute.

## Making It Real
The previous implementations highlight the control flow for various concurrency modes and not meant to be copy and paste solutions into your application. In a real production application, you need error handling (halt if any fail, continue if any fail, etc), support for termination (callers should be able to halt execution of tasks at any point), logging and more.

## Summary
The point of this article was really to show how easy it can be, especially compared to other programming languages, to control how your async code runs. TypeScript (JavaScript's) single threaded nature does pose some limitations but in return you get complete freedom from locking primitives such as mutexes and semaphores which greatly improves programming productivity (faster to read and write code) and reliability (fewer bugs).