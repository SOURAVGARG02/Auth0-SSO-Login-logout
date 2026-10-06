const { describe, test, expect } = require('@jest/globals');
const { ReplayCache } = require('../src/saml/replay-cache');

describe('ReplayCache', () => {
test('claims each assertion ID only once until the replay window expires', () => {
  let now = 1000;
  const cache = new ReplayCache({
    ttlMs: 100,
    maxEntries: 2,
    now: () => now,
  });

  expect(cache.claim('_assertion-1')).toBe(true);
  expect(cache.claim('_assertion-1')).toBe(false);

  now += 100;
  expect(cache.claim('_assertion-1')).toBe(true);
});

test('fails closed when the bounded cache is full of unexpired assertions', () => {
  const cache = new ReplayCache({
    ttlMs: 100,
    maxEntries: 1,
    now: () => 1000,
  });

  expect(cache.claim('_assertion-1')).toBe(true);
  expect(() => cache.claim('_assertion-2')).toThrow(/replay cache is full/);
});

test('rejects an empty assertion ID', () => {
  const cache = new ReplayCache({ ttlMs: 100, maxEntries: 1 });

  expect(() => cache.claim('')).toThrow(/non-empty assertion ID/);
});
});
