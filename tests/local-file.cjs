'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync(path.join(__dirname, '../local-file.js'), 'utf8');
const plain = value => JSON.parse(JSON.stringify(value));
const json = value => JSON.stringify(value, null, 2);
let checks = 0;
const check = fn => { fn(); checks++; };

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return {promise, resolve, reject};
}
async function drain() { for (let i = 0; i < 48; i++) await Promise.resolve(); }
async function until(predicate, message) {
  for (let i = 0; i < 200 && !predicate(); i++) await Promise.resolve();
  assert(predicate(), message);
}
async function bounded(promise, message) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => { timer = setTimeout(() => reject(Error(message)), 2500); })
    ]);
  } finally { clearTimeout(timer); }
}
async function settle(promise) {
  return bounded(Promise.resolve(promise).then(value => ({ok: true, value}), error => ({ok: false, error})), 'Controller operation did not settle');
}
class Clock {
  constructor() { this.now = 0; this.sequence = 0; this.timers = new Map(); }
  setTimeout(fn, delay) {
    const id = ++this.sequence;
    this.timers.set(id, {fn, at: this.now + Number(delay || 0)});
    return id;
  }
  clearTimeout(id) { this.timers.delete(id); }
  async tick(ms) {
    const target = this.now + ms;
    let turns = 0;
    for (;;) {
      const next = [...this.timers.entries()].filter(([, value]) => value.at <= target)
        .sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0];
      if (!next) break;
      assert(++turns < 1000, 'Unexpected repeating timer loop');
      this.now = next[1].at;
      this.timers.delete(next[0]);
      const result = next[1].fn();
      if (result && typeof result.catch === 'function') result.catch(() => {});
      await drain();
    }
    this.now = target;
    await drain();
  }
}
function setup(data = {counter: 0, note: '初始存档'}, delay = 300) {
  const clock = new Clock(), notices = [];
  const context = {
    setTimeout: clock.setTimeout.bind(clock),
    clearTimeout: clock.clearTimeout.bind(clock)
  };
  vm.createContext(context);
  vm.runInContext(source, context, {filename: 'local-file.js'});
  assert.equal('document' in context, false, 'Pure controller must load without document');
  assert.equal(typeof context.XB2_LOCAL_FILE?.create, 'function');
  const controller = context.XB2_LOCAL_FILE.create({
    getData: () => data,
    onStatus: state => notices.push(plain(state)),
    delay
  });
  return {controller, clock, notices, data};
}

// The fake file has an authoritative committed disk string. write() only changes
// a private staging buffer; successful close() alone commits it. A failed or
// aborted stream cannot change disk bytes, so assertions never mistake queued
// writes or in-memory getData() values for an actual persisted file.
function fileHandle(initialText, name = 'progress.json') {
  let disk = initialText, serial = 0, active = 0, maximumActive = 0;
  const events = [], writes = [];
  const plan = {createFailures: [], writeFailures: [], closeFailures: [], writeGates: [], closeGates: []};
  const handle = {
    kind: 'file', name,
    queryPermission: async () => 'granted',
    requestPermission: async () => 'granted',
    async getFile() {
      const snapshot = disk;
      events.push({type: 'read', text: snapshot});
      return {name, text: async () => snapshot};
    },
    async createWritable() {
      const id = ++serial;
      events.push({type: 'create', id});
      if (plan.createFailures.length) throw plan.createFailures.shift();
      active++; maximumActive = Math.max(maximumActive, active);
      let buffer = '', ended = false;
      const finish = () => { if (!ended) { ended = true; active--; } };
      return {
        async write(text) {
          events.push({type: 'write-start', id});
          const gate = plan.writeGates.shift();
          if (gate) await gate.promise;
          if (plan.writeFailures.length) {
            const error = plan.writeFailures.shift(); finish(); throw error;
          }
          assert.equal(typeof text, 'string', 'Controller should serialize the export object to JSON text');
          buffer = text; writes.push(text);
          events.push({type: 'write', id, text});
        },
        async close() {
          events.push({type: 'close-start', id});
          const gate = plan.closeGates.shift();
          if (gate) await gate.promise;
          if (plan.closeFailures.length) {
            const error = plan.closeFailures.shift(); finish(); throw error;
          }
          disk = buffer; finish(); events.push({type: 'commit', id, text: disk});
        },
        async abort() { finish(); events.push({type: 'abort', id}); }
      };
    }
  };
  return {
    handle, plan, events, writes,
    text: () => disk,
    externalWrite: text => { disk = text; events.push({type: 'external', text}); },
    active: () => active,
    maximumActive: () => maximumActive,
    createCount: () => events.filter(event => event.type === 'create').length,
    commits: () => events.filter(event => event.type === 'commit').length
  };
}

async function main() {
  // Unassociated controls do not manufacture writes or change the export object.
  {
    const {controller: c, clock, data} = setup(), before = plain(data);
    check(() => {
      const state = c.status();
      assert.equal(state.connected, false);
      assert.equal(state.pending, false);
      assert.equal(state.busy, false);
      assert.equal(state.error, null);
    });
    c.markDirty(); await clock.tick(1000); await settle(c.flush());
    check(() => { assert.equal(c.status().connected, false); assert.deepEqual(data, before); });
    await settle(Promise.resolve().then(() => c.attach(null, '')));
    check(() => assert.equal(c.status().connected, false));
    await c.disconnect();
  }

  // Association is exclusive. An invalid re-attach must not silently swap the
  // actual destination file or its baseline while still connected.
  {
    const {controller: c, data} = setup();
    const first = fileHandle(json(data), 'first.json'), other = fileHandle('other file', 'other.json');
    c.attach(first.handle, first.text());
    check(() => {
      assert.equal(c.status().connected, true);
      assert.equal(c.status().name, 'first.json');
      assert.equal(c.status().error, null);
    });
    await settle(Promise.resolve().then(() => c.attach(other.handle, other.text())));
    data.counter = 1; c.markDirty(); await settle(c.flush());
    check(() => {
      assert.equal(c.status().name, 'first.json');
      assert.equal(first.text(), json(data));
      assert.equal(other.text(), 'other file');
      assert.equal(other.createCount(), 0);
      assert.equal(c.status().pending, false);
    });
    await c.disconnect();
    c.attach(other.handle, other.text());
    check(() => { assert.equal(c.status().name, 'other.json'); assert.equal(c.status().error, null); });
    await c.disconnect();
  }

  // Debouncing saves the latest memory snapshot once, after the full quiet
  // period since the most recent edit. Repeated edits reset the same timer.
  {
    const {controller: c, clock, data, notices} = setup();
    const file = fileHandle(json(data)); c.attach(file.handle, file.text());
    data.counter = 1; c.markDirty();
    await clock.tick(299);
    check(() => { assert.equal(file.createCount(), 0); assert.equal(c.status().pending, true); });
    data.counter = 2; c.markDirty();
    await clock.tick(299);
    check(() => assert.equal(file.createCount(), 0));
    await clock.tick(1);
    check(() => {
      assert.equal(file.text(), json(data));
      assert.equal(file.createCount(), 1);
      assert.equal(file.commits(), 1);
      assert.equal(c.status().pending, false);
      assert.equal(c.status().busy, false);
      assert.equal(c.status().error, null);
      assert.notEqual(c.status().lastSaved, null);
      assert(notices.some(state => state.busy && state.pending));
    });
    await clock.tick(1000);
    check(() => assert.equal(file.createCount(), 1));
    await c.disconnect();
  }

  // Explicit flush coalesces all edits made before serialization into one write.
  {
    const {controller: c, clock, data} = setup();
    const file = fileHandle(json(data)); c.attach(file.handle, file.text());
    for (const counter of [1, 2, 3]) { data.counter = counter; c.markDirty(); }
    await settle(c.flush()); await clock.tick(1000);
    check(() => {
      assert.equal(file.text(), json(data));
      assert.deepEqual(file.writes, [json(data)]);
      assert.equal(file.maximumActive(), 1);
      assert.equal(c.status().pending, false);
    });
    await c.disconnect();
  }

  // A close-blocked transaction is not yet saved. Two new revisions and another
  // flush during that transaction must serialize afterwards, with no overlapping
  // writable stream and no stale revision accidentally marked as saved.
  {
    const {controller: c, clock, data} = setup();
    const initial = json(data), file = fileHandle(initial), closing = deferred();
    file.plan.closeGates.push(closing); c.attach(file.handle, initial);
    const previousSaved = c.status().lastSaved;
    data.counter = 1; const firstText = json(data); c.markDirty();
    const firstSave = settle(c.flush());
    await until(() => file.events.some(event => event.type === 'close-start'), 'First write did not reach close');
    check(() => {
      assert.equal(file.text(), initial);
      assert.equal(c.status().busy, true);
      assert.equal(c.status().pending, true);
      assert.equal(c.status().lastSaved, previousSaved);
      assert.equal(file.commits(), 0);
    });
    const replacement = fileHandle('separate destination', 'replacement.json');
    await settle(Promise.resolve().then(() => c.attach(replacement.handle, replacement.text())));
    data.counter = 2; c.markDirty(); data.counter = 3; c.markDirty();
    const finalText = json(data), secondSave = settle(c.flush());
    await drain();
    check(() => { assert.equal(file.createCount(), 1); assert.equal(file.active(), 1); assert.equal(replacement.createCount(), 0); });
    closing.resolve(); await Promise.all([firstSave, secondSave]); await clock.tick(1000);
    check(() => {
      assert.equal(file.text(), finalText);
      assert.deepEqual(file.writes, [firstText, finalText]);
      assert.equal(file.createCount(), 2);
      assert.equal(file.commits(), 2);
      assert.equal(file.maximumActive(), 1);
      assert.equal(file.active(), 0);
      assert.equal(c.status().pending, false);
      assert.equal(c.status().busy, false);
      assert.equal(c.status().error, null);
      assert.equal(c.status().name, file.handle.name);
      assert.notEqual(c.status().lastSaved, null);
      assert.equal(replacement.text(), 'separate destination');
    });
    await c.disconnect();
  }

  // External disk edits are detected against the last successful baseline before
  // any writable stream opens. Repeated flushes cannot bypass the conflict.
  {
    const {controller: c, data} = setup();
    const file = fileHandle(json(data)); c.attach(file.handle, file.text());
    data.counter = 1; c.markDirty();
    const external = json({counter: 900, note: '外部编辑'});
    file.externalWrite(external);
    await settle(c.flush());
    check(() => {
      assert.equal(file.text(), external);
      assert.equal(file.createCount(), 0);
      assert.equal(c.status().error.code, 'conflict');
      assert.equal(c.status().pending, true);
      assert.equal(c.status().busy, false);
    });
    data.counter = 2; c.markDirty(); await settle(c.flush());
    check(() => { assert.equal(file.text(), external); assert.equal(file.createCount(), 0); assert.equal(c.status().error.code, 'conflict'); });
    const memory = plain(data); await c.disconnect();
    check(() => { assert.equal(c.status().connected, false); assert.deepEqual(data, memory); assert.equal(file.text(), external); });
    // Re-association uses a freshly read baseline; it must not replace getData().
    c.attach(file.handle, file.text()); c.markDirty(); await settle(c.flush());
    check(() => { assert.equal(file.text(), json(data)); assert.equal(c.status().error, null); assert.equal(c.status().pending, false); });
    await c.disconnect();
  }

  // Cancellation, write failure, and close failure are recoverable. The committed
  // disk remains authoritative; no successful write/close means no saved state.
  for (const failure of ['cancel', 'create', 'write', 'close']) {
    const {controller: c, data, notices} = setup();
    const initial = json(data), file = fileHandle(initial); c.attach(file.handle, initial);
    const error = Error(`${failure} failure`);
    if (failure === 'cancel') error.name = 'AbortError';
    if (failure === 'cancel' || failure === 'create') file.plan.createFailures.push(error);
    else if (failure === 'write') file.plan.writeFailures.push(error);
    else file.plan.closeFailures.push(error);
    data.counter = 1; c.markDirty(); const previousSaved = c.status().lastSaved;
    await settle(c.flush());
    check(() => {
      assert.equal(file.text(), initial, `${failure}: failed save changed disk`);
      assert.equal(file.commits(), 0);
      assert.equal(c.status().error.code, 'write');
      assert.equal(c.status().pending, true);
      assert.equal(c.status().busy, false);
      assert.equal(c.status().lastSaved, previousSaved);
      assert(notices.some(state => state.error?.code === 'write'));
    });
    data.counter = 2; c.markDirty(); await settle(c.flush());
    check(() => {
      assert.equal(file.text(), json(data), `${failure}: retry did not commit the current data`);
      assert.equal(file.commits(), 1);
      assert.equal(file.maximumActive(), 1);
      assert.equal(c.status().pending, false);
      assert.equal(c.status().busy, false);
      assert.equal(c.status().error, null);
      assert.notEqual(c.status().lastSaved, null);
    });
    await c.disconnect();
  }

  // Disconnect cancels an edit that is only waiting for the debounce timer. It
  // changes the association, not the memory export, and cannot write afterwards.
  {
    const {controller: c, clock, data, notices} = setup();
    const initial = json(data), file = fileHandle(initial); c.attach(file.handle, initial);
    data.counter = 4; c.markDirty(); const memory = plain(data);
    await c.disconnect(); await clock.tick(1000); await settle(c.flush());
    check(() => {
      assert.equal(c.status().connected, false);
      assert.equal(c.status().busy, false);
      assert.equal(file.createCount(), 0);
      assert.equal(file.text(), initial);
      assert.deepEqual(data, memory);
      assert.equal(notices.at(-1).connected, false);
    });
    c.markDirty(); await clock.tick(1000);
    check(() => { assert.equal(file.createCount(), 0); assert.deepEqual(data, memory); });
  }

  // Disconnect waits for an already-open transaction's close rather than
  // pretending it has stopped or allowing a second association mid-write.
  {
    const {controller: c, clock, data} = setup();
    const initial = json(data), file = fileHandle(initial), closing = deferred();
    file.plan.closeGates.push(closing); c.attach(file.handle, initial);
    data.counter = 7; c.markDirty(); const memory = plain(data), save = settle(c.flush());
    await until(() => file.events.some(event => event.type === 'close-start'), 'Disconnect scenario did not reach close');
    let disconnected = false;
    const disconnect = c.disconnect().then(() => { disconnected = true; });
    await drain();
    check(() => { assert.equal(disconnected, false); assert.equal(c.status().busy, true); assert.equal(file.text(), initial); });
    closing.resolve(); await bounded(Promise.all([save, disconnect]), 'Disconnect did not await the transaction');
    await clock.tick(1000);
    check(() => {
      assert.equal(disconnected, true);
      assert.equal(c.status().connected, false);
      assert.equal(c.status().busy, false);
      assert.equal(file.text(), json(memory));
      assert.equal(file.commits(), 1);
      assert.deepEqual(data, memory);
    });
  }

  // A close failure while disconnect is waiting still releases the association,
  // leaves committed disk untouched, and does not discard the user's memory.
  {
    const {controller: c, data} = setup();
    const initial = json(data), file = fileHandle(initial), closing = deferred();
    file.plan.closeGates.push(closing); file.plan.closeFailures.push(Error('close failed during disconnect'));
    c.attach(file.handle, initial); data.counter = 8; c.markDirty(); const memory = plain(data);
    const save = settle(c.flush());
    await until(() => file.events.some(event => event.type === 'close-start'), 'Failure disconnect did not reach close');
    const disconnect = c.disconnect(); closing.resolve();
    await bounded(Promise.all([save, disconnect]), 'Disconnect did not finish after a failed close');
    check(() => { assert.equal(c.status().connected, false); assert.equal(file.text(), initial); assert.equal(file.commits(), 0); assert.deepEqual(data, memory); });
  }
  console.log(`Local file: ${checks} scenario checks passed; pure VM controller, authoritative fake disk, debounce, cancellation/retry, conflicts, serial writes and disconnect safety.`);
}

// Exporting the promise lets another asynchronous runner await this suite; direct
// execution also reports failures with a nonzero exit code.
module.exports = main();
module.exports.catch(error => { console.error(error); process.exitCode = 1; });
