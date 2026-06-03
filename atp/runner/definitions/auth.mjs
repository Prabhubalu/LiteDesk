import { defineHttpCase, defineCase, assertStatus, assertOneOfStatus, uniqueEmail, uid, ApiTestError } from '../lib/httpAssert.mjs';
import { getPersonaCredentials } from '../lib/authSession.mjs';
import { registerBody } from '../lib/payloads.mjs';

const registeredEmail = { value: null };

function profileUser(body) {
  return body?.data ?? body?.user ?? body;
}

export const authCases = [
  defineHttpCase('TC-API-AUTH-001', {
    auth: false,
    method: 'POST',
    path: '/api/auth/login',
    skipIf: () => (!getPersonaCredentials('owner') && 'Set fixtures/personas.json or ATP_PERSONA_OWNER_* env'),
    body: () => {
      const creds = getPersonaCredentials('owner');
      return { email: creds.email, password: creds.password };
    },
    expectStatus: 200,
    assertBody: (body) => {
      if (!body?.user && !body?.token && !body?.data?.token) {
        throw new ApiTestError('Missing user or token in login response');
      }
    },
  }),
  defineHttpCase('TC-API-AUTH-002', {
    auth: false,
    method: 'POST',
    path: '/api/auth/login',
    body: { email: 'invalid-atp@atp-test.local', password: 'wrong-password-xyz' },
    expectStatus: 401,
  }),
  defineCase('TC-API-AUTH-004', async (ctx) => {
    const email = uniqueEmail('register');
    registeredEmail.value = email;
    const res = await ctx.fetchSut('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(registerBody(email)),
    });
    const body = await assertOneOfStatus(res, [200, 201], { request: { method: 'POST', path: '/api/auth/register' } });
    if (!body?.token && !body?.user?.token) {
      throw new ApiTestError('Register response missing token', { response: { body } });
    }
  }),
  defineCase('TC-API-AUTH-005', async (ctx) => {
    const creds = getPersonaCredentials('owner');
    if (!creds?.email) {
      const err = new Error('Configure owner persona for duplicate registration test');
      err.skip = true;
      throw err;
    }
    const res = await ctx.fetchSut('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(registerBody(creds.email)),
    });
    await assertOneOfStatus(res, [400, 409, 422], { request: { method: 'POST', path: '/api/auth/register' } });
  }),
  defineHttpCase('TC-API-AUTH-006', {
    method: 'GET',
    path: '/api/users/profile',
    persona: 'owner',
    expectStatus: 200,
    assertBody: (body) => {
      const user = profileUser(body);
      if (!user?.email && !user?._id && !user?.id) {
        throw new ApiTestError('Profile response missing user fields', { response: { body } });
      }
    },
  }),
  defineCase('TC-API-AUTH-007', async (ctx) => {
    const res = await ctx.fetchSut('/api/users/profile', {
      headers: { Authorization: 'Bearer invalid-token-atp' },
    });
    await assertStatus(res, 401, { request: { method: 'GET', path: '/api/users/profile' } });
  }),
  defineHttpCase('TC-API-AUTH-008', {
    auth: false,
    method: 'GET',
    path: '/api/auth/test-version',
    expectStatus: 200,
  }),
];
