'use strict';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const {
  assertCircuitClosed,
  recordFailure,
  recordSuccess,
  wrapLlmAdapter,
  resetCircuitBreakerForTests,
  FAILURE_THRESHOLD,
} = require('../aiCircuitBreaker');
const { AiConfigurationError } = require('../errors');

describe('aiCircuitBreaker', () => {
  beforeEach(() => {
    resetCircuitBreakerForTests();
  });

  it('opens after FAILURE_THRESHOLD failures and blocks calls', () => {
    for (let i = 0; i < FAILURE_THRESHOLD; i += 1) {
      recordFailure('openai');
    }
    assert.throws(
      () => assertCircuitClosed('openai'),
      (err) => err instanceof AiConfigurationError && err.code === 'AI_UNAVAILABLE'
    );
  });

  it('resets after success', () => {
    for (let i = 0; i < FAILURE_THRESHOLD - 1; i += 1) {
      recordFailure('openai');
    }
    recordSuccess('openai');
    assert.doesNotThrow(() => assertCircuitClosed('openai'));
  });

  it('wrapLlmAdapter records failure on complete error', async () => {
    const adapter = wrapLlmAdapter('openai', {
      provider: 'openai',
      async complete() {
        throw new Error('boom');
      },
      async *stream() {
        yield { type: 'done', usage: {} };
      },
    });

    for (let i = 0; i < FAILURE_THRESHOLD; i += 1) {
      await assert.rejects(() => adapter.complete({}));
    }
    await assert.rejects(
      () => adapter.complete({}),
      (err) => err instanceof AiConfigurationError && err.code === 'AI_UNAVAILABLE'
    );
  });
});
