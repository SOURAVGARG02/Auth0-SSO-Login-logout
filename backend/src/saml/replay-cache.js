class ReplayCache {
  constructor({ ttlMs, maxEntries, now = Date.now }) {
    if (!Number.isSafeInteger(ttlMs) || ttlMs <= 0) {
      throw new TypeError('ttlMs must be a positive safe integer');
    }
    if (!Number.isSafeInteger(maxEntries) || maxEntries <= 0) {
      throw new TypeError('maxEntries must be a positive safe integer');
    }

    this.ttlMs = ttlMs;
    this.maxEntries = maxEntries;
    this.now = now;
    this.entries = new Map();
  }

  claim(id) {
    if (typeof id !== 'string' || id.length === 0) {
      throw new TypeError('A non-empty assertion ID is required');
    }

    const now = this.now();
    for (const [entryId, expiresAt] of this.entries) {
      if (expiresAt <= now) {
        this.entries.delete(entryId);
      }
    }

    if (this.entries.has(id)) {
      return false;
    }
    if (this.entries.size >= this.maxEntries) {
      throw new Error('SAML replay cache is full; refusing to accept another assertion');
    }

    this.entries.set(id, now + this.ttlMs);
    return true;
  }
}

module.exports = { ReplayCache };
