const assert = require('assert');
const { calculateDocumentCharges } = require('../chargeCalculationService');
const { CHARGE_TYPES, CHARGE_SCOPES } = require('../../constants/chargeConstants');

const packaging = {
  chargeId: 'c1',
  name: 'Packaging',
  chargeType: CHARGE_TYPES.FIXED_AMOUNT,
  chargeValue: 500,
  scope: CHARGE_SCOPES.ITEM
};

const freight = {
  chargeId: 'c2',
  name: 'Freight',
  chargeType: CHARGE_TYPES.FIXED_AMOUNT,
  chargeValue: 2000,
  scope: CHARGE_SCOPES.TRANSACTION
};

const insurance = {
  chargeId: 'c3',
  name: 'Insurance',
  chargeType: CHARGE_TYPES.PERCENTAGE,
  chargeValue: 2,
  scope: CHARGE_SCOPES.TRANSACTION
};

const result = calculateDocumentCharges({
  lines: [
    { lineId: 'l1', quantity: 2, unitPrice: 50000, charges: [packaging] }
  ],
  transactionCharges: [freight, insurance]
});

assert.equal(result.itemChargeTotal, 500);
assert.equal(result.transactionChargeTotal, 2000 + 2000); // freight 2000 + 2% of 100000
assert.equal(result.chargesTotal, 4500);

try {
  calculateDocumentCharges({
    lines: [{ quantity: 1, unitPrice: 100, charges: [freight] }]
  });
  assert.fail('expected scope error');
} catch (err) {
  assert.equal(err.code, 'CHARGE_SCOPE_INVALID');
}

console.log('chargeCalculationService.test.js: ok');
