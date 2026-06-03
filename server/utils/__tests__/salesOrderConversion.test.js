const test = require('node:test');
const assert = require('node:assert/strict');

const {
  resolveAcceptedLineIds,
  resolveParentLineIdsToConvert,
  buildSectionConversionPlans
} = require('../../services/salesOrderConversionService');
const { linesForSelection } = require('../../services/quotePublicAcceptanceService');

const sections = [
  {
    _id: 's1',
    quoteSectionId: 'sec-1',
    sectionTitle: 'Hardware',
    sectionOrder: 0,
    sectionType: 'standard',
    includeInQuoteTotal: true
  },
  {
    _id: 's2',
    quoteSectionId: 'sec-2',
    sectionTitle: 'Services',
    sectionOrder: 1,
    sectionType: 'standard',
    includeInQuoteTotal: true
  }
];

const lines = [
  { _id: 'm1', quoteLineId: 'l1', quoteSectionId: 's1', lineType: 'standard', hiddenLine: false, lineOrder: 0 },
  { _id: 'm2', quoteLineId: 'l2', quoteSectionId: 's2', lineType: 'standard', hiddenLine: false, lineOrder: 0 },
  {
    _id: 'bp',
    quoteLineId: 'b1',
    quoteSectionId: 's1',
    lineType: 'bundle_parent',
    hiddenLine: false,
    lineOrder: 1
  },
  {
    _id: 'bc',
    quoteLineId: 'b1c',
    quoteSectionId: 's1',
    lineType: 'bundle_component',
    parentBundleLineId: 'bp',
    hiddenLine: false,
    lineOrder: 2
  }
];

test('resolveAcceptedLineIds: uses customerResponse when present', () => {
  const quote = { customerResponse: { acceptedLineIds: ['l1'] } };
  assert.deepEqual(resolveAcceptedLineIds(quote, lines), ['l1']);
});

test('resolveAcceptedLineIds: full Accepted uses all selectable lines', () => {
  const quote = { status: 'Accepted', customerResponse: {} };
  const ids = resolveAcceptedLineIds(quote, lines);
  assert.ok(ids.includes('l1'));
  assert.ok(ids.includes('l2'));
  assert.ok(ids.includes('b1'));
  assert.equal(ids.includes('b1c'), false);
});

test('resolveParentLineIdsToConvert: rejects already converted lines', () => {
  assert.throws(
    () =>
      resolveParentLineIdsToConvert({
        acceptedLineIds: ['l1'],
        convertedLineIds: ['l1'],
        requestedLineIds: null
      }),
    (err) => err.code === 'ALREADY_CONVERTED'
  );
});

test('resolveParentLineIdsToConvert: subset via lineIds', () => {
  const selected = resolveParentLineIdsToConvert({
    acceptedLineIds: ['l1', 'l2'],
    convertedLineIds: [],
    requestedLineIds: ['l2']
  });
  assert.deepEqual(selected, ['l2']);
});

test('buildSectionConversionPlans: partial section when not all lines convert', () => {
  const linesToConvert = linesForSelection(lines, ['l1']);
  const plans = buildSectionConversionPlans(sections, lines, linesToConvert, ['l1', 'l2']);
  const hardware = plans.find((plan) => plan.quoteSectionMongoId === 's1');
  assert.equal(hardware.sectionAcceptanceType, 'partial');
});

test('buildSectionConversionPlans: full section when all accepted lines convert', () => {
  const linesToConvert = linesForSelection(lines, ['l1', 'b1']);
  const plans = buildSectionConversionPlans(sections, lines, linesToConvert, ['l1', 'b1']);
  const hardware = plans.find((plan) => plan.quoteSectionMongoId === 's1');
  assert.equal(hardware.sectionAcceptanceType, 'full');
});

test('linesForSelection: expands bundle children', () => {
  const expanded = linesForSelection(lines, ['b1']);
  const ids = expanded.map((line) => line.quoteLineId);
  assert.deepEqual(ids.sort(), ['b1', 'b1c'].sort());
});
