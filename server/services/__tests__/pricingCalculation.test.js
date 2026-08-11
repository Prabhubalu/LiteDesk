const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  runPricingPipeline,
  buyXGetYPaidUnits,
  selectBestPriceBook,
  applyAdjustment,
} = require('../../services/pricingCalculation');

test('volume rule then festival promo (corporate example, no tax)', () => {
  // Corporate list 55_000, qty 20 → volume 5%, Diwali 10%
  // 55000 * 0.95 = 52250; * 0.90 = 47025
  const result = runPricingPipeline({
    baseUnitPrice: 55000,
    quantity: 20,
    asOf: new Date('2026-10-20'),
    context: { customerType: 'CORPORATE' },
    rules: [
      {
        _id: 'r1',
        name: 'Volume 5%',
        status: 'ACTIVE',
        ruleType: 'QUANTITY',
        priority: 10,
        conditions: { minQty: 10 },
        adjustment: { type: 'percent', value: 5 },
      },
    ],
    promotions: [
      {
        _id: 'p1',
        name: 'Diwali',
        status: 'ACTIVE',
        promoType: 'FESTIVAL',
        priority: 10,
        effectiveFrom: new Date('2026-10-01'),
        effectiveUntil: new Date('2026-11-15'),
        action: { type: 'percent', value: 10 },
      },
    ],
  });
  assert.equal(result.listPrice, 55000);
  assert.equal(result.unitPrice, 47025);
  assert.equal(result.applied.length, 2);
});

test('contract rule then promo stacks', () => {
  const result = runPricingPipeline({
    baseUnitPrice: 60000,
    quantity: 1,
    asOf: new Date('2026-06-01'),
    context: { customerId: 'cust-abc' },
    rules: [
      {
        name: 'ABC Contract',
        status: 'ACTIVE',
        ruleType: 'CONTRACT',
        priority: 1,
        conditions: { customerIds: ['cust-abc'] },
        adjustment: { type: 'fixed_price', value: 48000 },
      },
    ],
    promotions: [
      {
        name: 'Festival 5%',
        status: 'ACTIVE',
        promoType: 'FESTIVAL',
        action: { type: 'percent', value: 5 },
      },
    ],
  });
  assert.equal(result.unitPrice, 45600);
});

test('expired promotion is rejected', () => {
  const result = runPricingPipeline({
    baseUnitPrice: 1000,
    quantity: 1,
    asOf: new Date('2026-08-01'),
    promotions: [
      {
        name: 'Summer Sale',
        status: 'ACTIVE',
        promoType: 'PRODUCT_DISCOUNT',
        effectiveUntil: new Date('2026-06-30'),
        action: { type: 'percent', value: 10 },
      },
    ],
  });
  assert.equal(result.unitPrice, 1000);
  assert.equal(result.applied.length, 0);
  assert.ok(result.rejections.some((r) => r.kind === 'promotion'));
});

test('volume rule min qty not met', () => {
  const result = runPricingPipeline({
    baseUnitPrice: 1000,
    quantity: 5,
    rules: [
      {
        name: 'Vol 10',
        status: 'ACTIVE',
        ruleType: 'QUANTITY',
        conditions: { minQty: 10 },
        adjustment: { type: 'percent', value: 5 },
      },
    ],
  });
  assert.equal(result.unitPrice, 1000);
  assert.equal(result.applied.length, 0);
});

test('buy X get Y paid units', () => {
  assert.equal(buyXGetYPaidUnits(3, 2, 1), 2);
  assert.equal(buyXGetYPaidUnits(5, 2, 1), 4);
  assert.equal(buyXGetYPaidUnits(1, 2, 1), 1);
});

test('buy X get Y adjusts unit price', () => {
  const result = runPricingPipeline({
    baseUnitPrice: 100,
    quantity: 3,
    promotions: [
      {
        name: 'BXGY',
        status: 'ACTIVE',
        promoType: 'BUY_X_GET_Y',
        action: { buyQty: 2, getQty: 1 },
      },
    ],
  });
  assert.equal(result.unitPrice, 66.67);
  assert.equal(result.applied[0].freeUnits, 1);
});

test('order discount requires order subtotal', () => {
  const promo = {
    name: 'Order 5%',
    status: 'ACTIVE',
    promoType: 'ORDER_DISCOUNT',
    conditions: { minOrderSubtotal: 100000 },
    action: { type: 'percent', value: 5 },
  };
  const low = runPricingPipeline({
    baseUnitPrice: 1000,
    quantity: 1,
    context: { orderSubtotal: 50000 },
    promotions: [promo],
  });
  assert.equal(low.unitPrice, 1000);
  const high = runPricingPipeline({
    baseUnitPrice: 1000,
    quantity: 1,
    context: { orderSubtotal: 150000 },
    promotions: [promo],
  });
  assert.equal(high.unitPrice, 950);
});

test('price book selection prefers customer type match', () => {
  const books = [
    { _id: 'std', name: 'Standard', isActive: true, isDefault: true, priority: 100 },
    {
      _id: 'corp',
      name: 'Corporate',
      isActive: true,
      customerTypes: ['CORPORATE'],
      priority: 50,
      currency: 'INR',
    },
  ];
  const best = selectBestPriceBook(books, {
    customerType: 'CORPORATE',
    currency: 'INR',
    asOf: new Date(),
  });
  assert.equal(best._id, 'corp');
});

test('applyAdjustment percent and fixed', () => {
  assert.equal(applyAdjustment(100, { type: 'percent', value: 10 }).unitPrice, 90);
  assert.equal(applyAdjustment(100, { type: 'fixed_price', value: 48 }).unitPrice, 48);
});
