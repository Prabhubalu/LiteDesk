const CUSTOMER_CREDIT_BALANCE_STATUSES = ['active', 'fully_applied', 'expired', 'void'];

const CUSTOMER_CREDIT_BALANCE_STATUS_DEFAULT = 'active';

const CUSTOMER_CREDIT_APPLICATION_STATUSES = ['active', 'reversed'];

const CUSTOMER_CREDIT_APPLICATION_STATUS_DEFAULT = 'active';

const STATEMENT_LINE_TYPES = [
  'invoice',
  'credit_note',
  'payment_allocation',
  'customer_credit_application',
  'write_off'
];

module.exports = {
  CUSTOMER_CREDIT_BALANCE_STATUSES,
  CUSTOMER_CREDIT_BALANCE_STATUS_DEFAULT,
  CUSTOMER_CREDIT_APPLICATION_STATUSES,
  CUSTOMER_CREDIT_APPLICATION_STATUS_DEFAULT,
  STATEMENT_LINE_TYPES
};
