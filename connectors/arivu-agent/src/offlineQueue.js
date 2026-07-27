'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * File-based JSONL offline queue under ProgramData\Arivu\Connector\queue.
 * Each line: { id, type, payload, createdAt, attempts, lastError }
 */
class OfflineQueue {
  constructor(dataDir) {
    this.queueDir = path.join(dataDir, 'queue');
    this.queueFile = path.join(this.queueDir, 'pending.jsonl');
    fs.mkdirSync(this.queueDir, { recursive: true });
    if (!fs.existsSync(this.queueFile)) {
      fs.writeFileSync(this.queueFile, '', 'utf8');
    }
  }

  enqueue(type, payload) {
    const MAX_PENDING = 5000;
    if (this.length() >= MAX_PENDING) {
      // Drop oldest into dead-letter file to keep agent healthy
      const items = this.list();
      const dropped = items.slice(0, Math.max(1, items.length - MAX_PENDING + 1));
      const dlq = path.join(this.queueDir, 'dead-letter.jsonl');
      for (const d of dropped) {
        fs.appendFileSync(dlq, `${JSON.stringify({ ...d, deadLetteredAt: new Date().toISOString() })}\n`);
      }
      this._rewrite(items.slice(dropped.length));
    }
    const item = {
      id: crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex'),
      type: String(type),
      payload: payload || {},
      createdAt: new Date().toISOString(),
      attempts: 0,
      lastError: null,
    };
    fs.appendFileSync(this.queueFile, `${JSON.stringify(item)}\n`, 'utf8');
    return item;
  }

  /**
   * Read all pending items (skip blank / corrupt lines).
   */
  list() {
    const raw = fs.readFileSync(this.queueFile, 'utf8');
    if (!raw.trim()) return [];
    const items = [];
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        items.push(JSON.parse(trimmed));
      } catch (_) {
        /* skip corrupt */
      }
    }
    return items;
  }

  length() {
    return this.list().length;
  }

  /**
   * Rewrite queue file with remaining items.
   */
  _rewrite(items) {
    const body = items.map((i) => JSON.stringify(i)).join('\n');
    fs.writeFileSync(this.queueFile, body ? `${body}\n` : '', 'utf8');
  }

  remove(id) {
    const remaining = this.list().filter((i) => i.id !== id);
    this._rewrite(remaining);
  }

  update(id, patch) {
    const items = this.list().map((i) => (i.id === id ? { ...i, ...patch } : i));
    this._rewrite(items);
  }

  /**
   * Drain queue via async handler(item) → boolean ok.
   * Failed items stay with incremented attempts.
   */
  async flush(handler) {
    const items = this.list();
    if (!items.length) return { flushed: 0, failed: 0 };

    const remaining = [];
    let flushed = 0;
    let failed = 0;

    for (const item of items) {
      try {
        // eslint-disable-next-line no-await-in-loop
        const ok = await handler(item);
        if (ok) {
          flushed += 1;
        } else {
          failed += 1;
          remaining.push({
            ...item,
            attempts: (item.attempts || 0) + 1,
            lastError: 'handler returned false',
          });
        }
      } catch (err) {
        failed += 1;
        remaining.push({
          ...item,
          attempts: (item.attempts || 0) + 1,
          lastError: err.message || String(err),
        });
      }
    }

    this._rewrite(remaining);
    return { flushed, failed, remaining: remaining.length };
  }
}

module.exports = { OfflineQueue };
