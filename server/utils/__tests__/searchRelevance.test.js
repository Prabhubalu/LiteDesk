const test = require('node:test');
const assert = require('node:assert/strict');
const {
  scoreTextMatch,
  sortBySearchRelevance,
  buildContainsRegex,
  buildSearchOrConditions,
  parseSearchTerms,
  scoreRecordMatch,
  escapeSearchRegex,
  fetchRankedSearchPage,
  SEARCH_FIELD_PRESETS
} = require('../searchRelevance');

test('scoreTextMatch: prefix ranks above contains', () => {
  assert.equal(scoreTextMatch('Acme Corp', 'Ac'), 0);
  assert.equal(scoreTextMatch('BigXAcme Corp', 'Ac'), 2);
});

test('scoreTextMatch: word-boundary prefix ranks between prefix and contains', () => {
  assert.equal(scoreTextMatch('John Smith', 'Smi'), 1);
  assert.equal(scoreTextMatch('Smithson', 'Smi'), 0);
});

test('sortBySearchRelevance: prefix matches appear first', () => {
  const items = [
    { name: 'Beta Acme' },
    { name: 'Acme Industries' },
    { name: 'Gamma Acme' }
  ];
  const sorted = sortBySearchRelevance(items, 'Acme', [
    { getValue: (r) => r.name, primary: true }
  ]);
  assert.equal(sorted[0].name, 'Acme Industries');
});

test('buildContainsRegex: escapes special characters', () => {
  const regex = buildContainsRegex('acme (test)');
  assert.equal(regex.test('ACME (TEST) LLC'), true);
  assert.equal(regex.test('acme test'), false);
});

test('escapeSearchRegex: escapes regex metacharacters', () => {
  assert.equal(escapeSearchRegex('a.b+c'), 'a\\.b\\+c');
});

test('parseSearchTerms: comma-separated values become OR terms', () => {
  assert.deepEqual(parseSearchTerms('John, David, Sarah'), ['John', 'David', 'Sarah']);
  assert.deepEqual(parseSearchTerms('John'), ['John']);
  assert.deepEqual(parseSearchTerms('  John ,  '), ['John']);
  assert.deepEqual(parseSearchTerms(''), []);
});

test('buildSearchOrConditions: multi-term expands field conditions', () => {
  const conditions = buildSearchOrConditions('John, David', ['first_name', 'last_name']);
  assert.equal(conditions.length, 4);
  assert.ok(conditions[0].first_name);
  assert.ok(conditions[3].last_name);
});

test('scoreRecordMatch: matches any comma-separated term', () => {
  const record = { first_name: 'David', last_name: 'Miller' };
  const score = scoreRecordMatch(record, 'John, David', [
    { getValue: (r) => r.first_name, primary: true },
    { getValue: (r) => r.last_name, primary: true }
  ]);
  assert.equal(score, 0);
});

test('sortBySearchRelevance: multi-term ranks best matching term', () => {
  const items = [
    { name: 'Team David Project' },
    { name: 'David Lee' },
    { name: 'Team John Project' }
  ];
  const sorted = sortBySearchRelevance(items, 'John, David', [
    { getValue: (r) => r.name, primary: true }
  ]);
  assert.equal(sorted[0].name, 'David Lee');
});

test('fetchRankedSearchPage: active search builds relevance pipeline without error', async () => {
  const pipelines = [];
  const Model = {
    aggregate: async (pipeline) => {
      pipelines.push(pipeline);
      return [];
    },
    find: () => ({
      populate: () => ({
        lean: async () => []
      }),
      sort: () => ({
        skip: () => ({
          limit: () => ({
            lean: async () => []
          })
        })
      })
    })
  };

  await fetchRankedSearchPage(Model, {
    matchQuery: { organizationId: '507f1f77bcf86cd799439011' },
    searchTerm: 'John',
    fieldSpecs: SEARCH_FIELD_PRESETS.people,
    limit: 10
  });

  assert.equal(pipelines.length, 1);
  assert.ok(pipelines[0][1].$addFields._searchScore);
});

test('resolveListSearchTerm: prefers direct search over column filterQuery', () => {
  const { resolveListSearchTerm } = require('../searchRelevance');
  const ast = {
    logic: 'AND',
    children: [{ fieldKey: 'name', operator: 'contains', value: 'Column' }],
  };
  assert.equal(
    resolveListSearchTerm({ search: 'Main', filterQuery: JSON.stringify(ast) }, 'organizations'),
    'Main'
  );
});

test('resolveListSearchTerm: falls back to column contains on primary field', () => {
  const { resolveListSearchTerm } = require('../searchRelevance');
  const ast = {
    logic: 'AND',
    children: [{ fieldKey: 'name', operator: 'contains', value: 'Karpe' }],
  };
  assert.equal(
    resolveListSearchTerm({ filterQuery: JSON.stringify(ast) }, 'organizations'),
    'Karpe'
  );
});
