const test = require('node:test');
const assert = require('node:assert/strict');

async function* rowsFromEntries(entries) {
  for (const entry of entries) {
    yield entry;
  }
}

test('countImportDuplicates splits CRM matches and in-file repeats', async (t) => {
  const People = require('../../../models/People');
  t.mock.method(People, 'find', () => ({
    select: () => ({
      lean: async () => [{ email: 'exists@example.com' }],
    }),
  }));

  const { countImportDuplicates } = require('../importDuplicateQuery');
  const fieldMapping = { Email: 'email', Name: 'first_name' };
  const rows = rowsFromEntries([
    { rowNumber: 2, row: { Email: 'new@example.com', Name: 'New' } },
    { rowNumber: 3, row: { Email: 'new@example.com', Name: 'New Duplicate' } },
    { rowNumber: 4, row: { Email: 'exists@example.com', Name: 'Existing' } },
  ]);

  const result = await countImportDuplicates({
    module: 'contacts',
    rows,
    fieldMapping,
    checkFields: ['email'],
    organizationId: 'org-1',
  });

  assert.equal(result.unique, 1);
  assert.equal(result.existingDuplicates, 1);
  assert.equal(result.inFileDuplicates, 1);
  assert.equal(result.duplicates, 2);
  assert.equal(result.inFileDuplicateSamples.length, 1);
  assert.equal(result.inFileDuplicateSamples[0].rowNumber, 3);
  assert.equal(result.inFileDuplicateSamples[0].firstSeenRow, 2);
  assert.equal(result.existingDuplicateSamples.length, 1);
  assert.equal(result.existingDuplicateSamples[0].rowNumber, 4);

  t.mock.restoreAll();
});
