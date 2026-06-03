const {
  QUOTE_SECTION_TYPES,
  QUOTE_SECTION_TYPE_DEFAULT,
  DEFAULT_SECTION_TITLE,
  assertValidSectionType
} = require('./quoteSection');

module.exports = {
  SALES_ORDER_SECTION_TYPES: QUOTE_SECTION_TYPES,
  SALES_ORDER_SECTION_TYPE_DEFAULT: QUOTE_SECTION_TYPE_DEFAULT,
  DEFAULT_SECTION_TITLE,
  assertValidSalesOrderSectionType: assertValidSectionType
};
