import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getConfig } from '../../shared/config.mjs';
import { recordFlowStep } from './flowTrace.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.join(__dirname, '../../fixtures');

/** @type {Map<string, { email: string, password: string, token?: string|null, user?: object, organization?: object }>} */
const tokenCache = new Map();

export function loadPersonas() {
  const config = getConfig();
  const file = path.join(FIXTURES_DIR, 'personas.json');
  const defaults = {
    owner: {
      email: config.personaOwnerEmail,
      password: config.personaOwnerPassword,
    },
    viewer: {
      email: process.env.ATP_PERSONA_VIEWER_EMAIL || '',
      password: process.env.ATP_PERSONA_VIEWER_PASSWORD || '',
    },
  };

  if (fs.existsSync(file)) {
    const fromFile = JSON.parse(fs.readFileSync(file, 'utf8'));
    return { ...defaults, ...fromFile };
  }
  return defaults;
}

export function getPersonaCredentials(personaKey) {
  const personas = loadPersonas();
  const p = personas[personaKey];
  if (!p?.email || !p?.password) {
    return null;
  }
  return p;
}

export async function loginPersona(ctx, personaKey = 'owner') {
  const cacheKey = `${ctx.envKey}:${personaKey}`;
  if (tokenCache.has(cacheKey)) {
    recordFlowStep(ctx.store, {
      kind: 'auth',
      label: `Session cache (${personaKey})`,
      path: '/api/auth/login',
      method: 'POST',
      status: 'cached',
      durationMs: 0,
    });
    return tokenCache.get(cacheKey);
  }

  const creds = getPersonaCredentials(personaKey);
  if (!creds) {
    throw new Error(`Persona "${personaKey}" not configured — set fixtures/personas.json or ATP_PERSONA_* env`);
  }

  const res = await ctx.fetchSut('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: creds.email, password: creds.password }),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(`Login failed for persona "${personaKey}": HTTP ${res.status}`);
    err.response = { status: res.status, body };
    throw err;
  }

  const session = {
    token: body.token || body.user?.token,
    user: body.user,
    organization: body.organization,
  };
  tokenCache.set(cacheKey, session);
  return session;
}

export async function authFetch(ctx, personaKey, apiPath, init = {}) {
  const session = await loginPersona(ctx, personaKey);
  const headers = new Headers(init.headers || {});
  headers.set('Authorization', `Bearer ${session.token}`);
  if (!headers.has('Content-Type') && init.body && typeof init.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }
  return ctx.fetchSut(apiPath, { ...init, headers });
}

export function clearPersonaCache() {
  tokenCache.clear();
}
