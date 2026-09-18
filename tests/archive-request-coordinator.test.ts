import assert from "node:assert/strict";
import test from "node:test";
import { ArchiveRequestCoordinator } from "../lib/archive-request-coordinator.ts";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

test("una risposta lenta A non può essere attribuita all'archivio B", async () => {
  const coordinator = new ArchiveRequestCoordinator();
  const slowA = deferred<string>();
  const fastB = deferred<string>();
  const committed: string[] = [];

  const requestA = coordinator.begin();
  const taskA = slowA.promise.then((value) => {
    if (requestA.isCurrent()) committed.push(value);
  });
  const requestB = coordinator.begin();
  const taskB = fastB.promise.then((value) => {
    if (requestB.isCurrent()) committed.push(value);
  });

  fastB.resolve("B");
  await taskB;
  slowA.resolve("A");
  await taskA;
  assert.deepEqual(committed, ["B"]);
  assert.equal(requestA.signal.aborted, true);
});

test("chiudere l'archivio invalida la risposta ancora in volo", async () => {
  const coordinator = new ArchiveRequestCoordinator();
  const request = coordinator.begin();
  coordinator.cancel();
  assert.equal(request.signal.aborted, true);
  assert.equal(request.isCurrent(), false);
});
