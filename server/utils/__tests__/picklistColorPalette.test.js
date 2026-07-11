const test = require('node:test');
const assert = require('node:assert/strict');
const {
    PICKLIST_COLOR_PALETTE,
    PLATFORM_DEFAULT_PICKLIST_COLOR,
    nextPicklistOptionColor,
    resolveNewPicklistOptionColor,
    backfillPicklistOptionColors,
    isPlatformDefaultPicklistColor,
    getSemanticPicklistColor,
} = require('../picklistColorPalette');

test('nextPicklistOptionColor assigns distinct palette colors', () => {
    const first = nextPicklistOptionColor([]);
    const second = nextPicklistOptionColor([{ value: 'A', color: first }]);
    assert.notEqual(first, second);
    assert.equal(PICKLIST_COLOR_PALETTE.includes(first), true);
    assert.equal(PICKLIST_COLOR_PALETTE.includes(second), true);
});

test('resolveNewPicklistOptionColor uses semantic task status colors', () => {
    const color = resolveNewPicklistOptionColor({
        fieldKey: 'status',
        moduleKey: 'tasks',
        optionValue: 'completed',
        existingOptions: [],
    });
    assert.equal(color, '#16A34A');
});

test('backfillPicklistOptionColors replaces platform default blue only', () => {
    const input = [
        { value: 'A', color: PLATFORM_DEFAULT_PICKLIST_COLOR },
        { value: 'B', color: '#EC4899' },
        { value: 'C' },
    ];
    const out = backfillPicklistOptionColors(input, 'industry', 'organizations');
    assert.equal(out.length, 3);
    assert.notEqual(out[0].color, PLATFORM_DEFAULT_PICKLIST_COLOR);
    assert.equal(out[1].color, '#EC4899');
    assert.notEqual(out[2].color, PLATFORM_DEFAULT_PICKLIST_COLOR);
    assert.notEqual(out[0].color, out[2].color);
});

test('backfillPicklistOptionColors applies lead status semantics', () => {
    const out = backfillPicklistOptionColors(
        [{ value: 'Qualified' }, { value: 'Custom Stage', color: PLATFORM_DEFAULT_PICKLIST_COLOR }],
        'lead_status',
        'people'
    );
    assert.equal(out[0].color, getSemanticPicklistColor('lead_status', 'Qualified', 'people'));
    assert.notEqual(out[1].color, PLATFORM_DEFAULT_PICKLIST_COLOR);
});

test('getSemanticPicklistColor returns organization type colors', () => {
    assert.equal(getSemanticPicklistColor('types', 'Customer', 'organizations'), '#2563EB');
    assert.equal(getSemanticPicklistColor('types', 'Partner', 'organizations'), '#8B5CF6');
    assert.equal(getSemanticPicklistColor('types', 'Vendor', 'organizations'), '#10B981');
});

test('backfillPicklistOptionColors applies organization type semantics', () => {
    const out = backfillPicklistOptionColors(
        [{ value: 'Customer' }, { value: 'Partner' }, { value: 'Vendor' }],
        'types',
        'organizations'
    );
    assert.equal(out[0].color, '#2563EB');
    assert.equal(out[1].color, '#8B5CF6');
    assert.equal(out[2].color, '#10B981');
});

test('isPlatformDefaultPicklistColor treats missing color as default', () => {
    assert.equal(isPlatformDefaultPicklistColor(null), true);
    assert.equal(isPlatformDefaultPicklistColor(PLATFORM_DEFAULT_PICKLIST_COLOR), true);
    assert.equal(isPlatformDefaultPicklistColor('#EC4899'), false);
});
