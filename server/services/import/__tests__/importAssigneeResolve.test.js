const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveImportAssignee } = require('../importRowProcessors');

function makeLookup(users) {
  const byId = new Map();
  const byEmail = new Map();
  const byUsername = new Map();
  const byName = new Map();
  for (const user of users) {
    byId.set(String(user._id), user._id);
    if (user.email) byEmail.set(user.email.toLowerCase(), user._id);
    if (user.username) byUsername.set(user.username.toLowerCase(), user._id);
    const full = `${user.firstName || ''} ${user.lastName || ''}`
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');
    if (full) {
      const list = byName.get(full) || [];
      list.push(user._id);
      byName.set(full, list);
    }
  }
  return { byId, byEmail, byUsername, byName };
}

const fallback = 'fallbackuser0000000000001';
const darshanId = '6a4cf8545595091b7983b1b5';
const lookup = makeLookup([
  {
    _id: darshanId,
    firstName: 'Darshan',
    lastName: 'Admin',
    email: 'hello@arivusystems.com',
    username: 'Arivu Admin',
  },
]);

test('resolveImportAssignee falls back when empty', () => {
  assert.deepEqual(resolveImportAssignee('', lookup, fallback), { id: fallback });
  assert.deepEqual(resolveImportAssignee(undefined, lookup, fallback), { id: fallback });
});

test('resolveImportAssignee resolves export-style full name', () => {
  assert.deepEqual(resolveImportAssignee('Darshan Admin', lookup, fallback), { id: darshanId });
  assert.deepEqual(resolveImportAssignee('  darshan   admin  ', lookup, fallback), { id: darshanId });
});

test('resolveImportAssignee resolves email and username', () => {
  assert.deepEqual(
    resolveImportAssignee('hello@arivusystems.com', lookup, fallback),
    { id: darshanId }
  );
  assert.deepEqual(resolveImportAssignee('Arivu Admin', lookup, fallback), { id: darshanId });
});

test('resolveImportAssignee resolves object id in tenant', () => {
  assert.deepEqual(resolveImportAssignee(darshanId, lookup, fallback), { id: darshanId });
});

test('resolveImportAssignee errors on unknown name', () => {
  assert.deepEqual(resolveImportAssignee('Darshan S', lookup, fallback), {
    error: 'Assigned user not found: Darshan S',
  });
});
