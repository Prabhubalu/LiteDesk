'use strict';

/**
 * In-process provider circuit breaker.
 * Open circuit → AI unavailable (CRM stays up); never blocks non-AI flows.
 */

const { AiConfigurationError } = require('./errors');

const FAILURE_THRESHOLD = Math.max(
  1,
  Number.parseInt(process.env.AI_CIRCUIT_FAILURE_THRESHOLD || '5', 10) || 5
);
const COOLDOWN_MS = Math.max(
  1000,
  Number.parseInt(process.env.AI_CIRCUIT_COOLDOWN_MS || String(60 * 1000), 10) || 60_000
);

/** @type {Map<string, { failures: number, openedAt: number | null, halfOpen: boolean }>} */
const states = new Map();

function getState(provider) {
  const key = String(provider || 'unknown').toLowerCase();
  if (!states.has(key)) {
    states.set(key, { failures: 0, openedAt: null, halfOpen: false });
  }
  return states.get(key);
}

function assertCircuitClosed(provider) {
  const state = getState(provider);
  if (!state.openedAt) return;

  const elapsed = Date.now() - state.openedAt;
  if (elapsed >= COOLDOWN_MS) {
    state.halfOpen = true;
    return;
  }

  const err = new AiConfigurationError(
    'AI provider temporarily unavailable. Try again shortly.',
    'AI_UNAVAILABLE'
  );
  err.statusCode = 503;
  throw err;
}

function recordSuccess(provider) {
  const state = getState(provider);
  state.failures = 0;
  state.openedAt = null;
  state.halfOpen = false;
}

function recordFailure(provider) {
  const state = getState(provider);
  if (state.halfOpen) {
    state.openedAt = Date.now();
    state.halfOpen = false;
    state.failures = FAILURE_THRESHOLD;
    return;
  }

  state.failures += 1;
  if (state.failures >= FAILURE_THRESHOLD) {
    state.openedAt = Date.now();
  }
}

function wrapLlmAdapter(provider, adapter) {
  if (!adapter) return adapter;

  return {
    provider: adapter.provider || provider,
    async complete(args) {
      assertCircuitClosed(provider);
      try {
        const result = await adapter.complete(args);
        recordSuccess(provider);
        return result;
      } catch (error) {
        recordFailure(provider);
        throw error;
      }
    },
    async *stream(args) {
      assertCircuitClosed(provider);
      try {
        for await (const event of adapter.stream(args)) {
          yield event;
        }
        recordSuccess(provider);
      } catch (error) {
        recordFailure(provider);
        throw error;
      }
    },
  };
}

function resetCircuitBreakerForTests() {
  states.clear();
}

function getCircuitBreakerStateForTests(provider) {
  return { ...getState(provider) };
}

module.exports = {
  assertCircuitClosed,
  recordSuccess,
  recordFailure,
  wrapLlmAdapter,
  resetCircuitBreakerForTests,
  getCircuitBreakerStateForTests,
  FAILURE_THRESHOLD,
  COOLDOWN_MS,
};
