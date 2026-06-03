import { getConfig } from '../shared/config.mjs';
import { loginPersona, authFetch as sessionAuthFetch } from './lib/authSession.mjs';
import { wrapTimedFetch } from './lib/requestTiming.mjs';

/**
 * @typedef {Object} RunContext
 * @property {string} caseId
 * @property {string} envKey
 * @property {string} sutApiUrl
 * @property {boolean} dryRun
 * @property {Record<string, unknown>} store
 * @property {(path: string, init?: RequestInit) => Promise<Response>} fetchSut
 * @property {(personaKey?: string) => Promise<object>} loginPersona
 * @property {(personaKey: string, path: string, init?: RequestInit) => Promise<Response>} authFetch
 * @property {() => Promise<string|null>} getAuthToken
 */

export function createContext({ caseId, envKey, dryRun }) {
  const config = getConfig();
  const sutApiUrl = config.sutApiUrl;
  /** @type {Record<string, unknown>} */
  const store = {};

  const base = { caseId, envKey, sutApiUrl, dryRun, store };

  async function rawFetchSut(apiPath, init = {}) {
    const url = apiPath.startsWith('http') ? apiPath : `${sutApiUrl}${apiPath.startsWith('/') ? '' : '/'}${apiPath}`;
    const headers = new Headers(init.headers || {});
    if (!headers.has('Content-Type') && init.body && typeof init.body === 'string') {
      headers.set('Content-Type', 'application/json');
    }
    return fetch(url, { ...init, headers });
  }

  const fetchSut = wrapTimedFetch(rawFetchSut, store);

  const ctx = {
    ...base,
    fetchSut,
    loginPersona: (personaKey = 'owner') => loginPersona({ ...base, fetchSut, store }, personaKey),
    authFetch: (personaKey, apiPath, init) => sessionAuthFetch({ ...base, fetchSut, store }, personaKey, apiPath, init),
    getAuthToken: async () => {
      const s = await loginPersona({ ...base, fetchSut, store }, 'owner');
      return s.token;
    },
  };

  return ctx;
}
