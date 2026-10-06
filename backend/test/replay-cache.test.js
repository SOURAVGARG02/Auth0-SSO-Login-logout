const test = require('node:test');
const assert = require('node:assert/strict');
const { ReplayCache } = require('../src/saml/replay-cache');

test('claims each assertion ID only once until the replay window expires', () => {
  let now = 1000;
  const cache = new ReplayCache({
    ttlMs: 100,
    maxEntries: 2,
    now: () => now,
  });

  assert.equal(cache.claim('_assertion-1'), true);
  assert.equal(cache.claim('_assertion-1'), false);

  now += 100;
  assert.equal(cache.claim('_assertion-1'), true);
});

test('fails closed when the bounded cache is full of unexpired assertions', () => {
  const cache = new ReplayCache({
    ttlMs: 100,
    maxEntries: 1,
    now: () => 1000,
  });

  assert.equal(cache.claim('_assertion-1'), true);
  assert.throws(
    () => cache.claim('_assertion-2'),
    /replay cache is full/
  );
});

test('rejects an empty assertion ID', () => {
  const cache = new ReplayCache({ ttlMs: 100, maxEntries: 1 });

  assert.throws(() => cache.claim(''), /non-empty assertion ID/);
});
