/**
 * INV0 inventory integration test helpers.
 */

const crypto = require('crypto');
const mongoose = require('mongoose');
const Organization = require('../../../models/Organization');
const Item = require('../../../models/Item');
const ItemVariant = require('../../../models/ItemVariant');
const SalesOrder = require('../../../models/SalesOrder');
const SalesOrderLine = require('../../../models/SalesOrderLine');
const InventoryReservation = require('../../../models/InventoryReservation');
const InventoryLocation = require('../../../models/InventoryLocation');

async function createTestOrganization(label = 'tenant') {
  const suffix = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
  return Organization.create({
    name: `Inventory Test ${label} ${suffix}`,
    slug: `inv-${label}-${suffix}`,
    isTenant: true,
    isActive: true
  });
}

async function createTestVariant({ organizationId, costPrice = 10, unitOfMeasure = 'ea' } = {}) {
  const userId = new mongoose.Types.ObjectId();
  const item = await Item.create({
    organizationId,
    item_name: `Test Item ${Date.now()}`,
    item_code: `SKU-${crypto.randomUUID().slice(0, 8)}`,
    lifecycle_state: 'Active',
    createdBy: userId
  });

  const variant = await ItemVariant.create({
    organizationId,
    itemId: item._id,
    variant_code: `VAR-${crypto.randomUUID().slice(0, 8)}`,
    is_default: true,
    lifecycle_state: 'Active',
    unit_of_measure: unitOfMeasure,
    cost_price: costPrice,
    createdBy: userId
  });

  return { item, variant, userId };
}

async function seedInventoryContext() {
  const tenant = await createTestOrganization('tenant');
  const { variant, userId } = await createTestVariant({ organizationId: tenant._id });
  return { tenant, variant, userId };
}

async function createTestSalesOrderWithLine({
  organizationId,
  userId,
  variantId,
  quantity = 10,
  status = 'Draft'
}) {
  const order = await SalesOrder.create({
    organizationId,
    orderTitle: 'Inventory SO Test',
    status,
    fulfillmentMode: 'product',
    currency: 'USD',
    sourceType: 'manual',
    lineageType: 'standalone',
    createdBy: userId,
    modifiedBy: userId
  });

  const line = await SalesOrderLine.create({
    organizationId,
    salesOrderId: order._id,
    variantId,
    lineType: 'standard',
    quantity,
    unitPriceSnapshot: 25,
    lineSubtotal: quantity * 25,
    lineTaxTotal: 0,
    lineTotal: quantity * 25
  });

  return { order, line };
}

async function createSecondaryLocation({ organizationId, userId, locationCode = 'SEC', name = 'Secondary Warehouse' }) {
  return InventoryLocation.create({
    organizationId,
    locationCode,
    name,
    locationType: 'warehouse',
    status: 'active',
    isDefault: false,
    createdBy: userId || null
  });
}

module.exports = {
  createTestOrganization,
  createTestVariant,
  seedInventoryContext,
  createTestSalesOrderWithLine,
  createSecondaryLocation
};
