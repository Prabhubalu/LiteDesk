/**
 * Utility functions for displaying field values based on field definitions
 */

/**
 * Get key fields from a module definition
 * @param {Object} moduleDefinition - The module definition object
 * @returns {Array} Array of key field definitions
 */
export const getKeyFields = (moduleDefinition) => {
  if (!moduleDefinition?.fields) return [];
  
  return moduleDefinition.fields
    .filter(field => field.keyField === true)
    .sort((a, b) => (a.order || 0) - (b.order || 0));
};

/**
 * Get formatted field value from a record based on field definition
 * @param {Object} fieldDef - The field definition
 * @param {Object} record - The record data
 * @returns {string|null} Formatted value or null if empty
 */
export const getFieldValue = (fieldDef, record) => {
  const value = record?.[fieldDef.key];
  
  if (value === null || value === undefined || value === '') {
    return null;
  }
  
  // Handle different data types
  switch (fieldDef.dataType) {
    case 'Date':
      return value ? new Date(value).toLocaleDateString() : null;
    case 'Date-Time':
      return value ? new Date(value).toLocaleString() : null;
    case 'Currency':
      const currencySymbol = fieldDef.numberSettings?.currencySymbol || '$';
      const decimalPlaces = fieldDef.numberSettings?.decimalPlaces || 2;
      return value !== undefined ? `${currencySymbol}${parseFloat(value).toFixed(decimalPlaces)}` : null;
    case 'Decimal':
      const decimalPlaces2 = fieldDef.numberSettings?.decimalPlaces || 2;
      return value !== undefined ? parseFloat(value).toFixed(decimalPlaces2) : null;
    case 'Integer':
      return value !== undefined ? parseInt(value).toLocaleString() : null;
    case 'Picklist':
      return value;
    case 'Multi-Picklist':
      return Array.isArray(value) ? value.join(', ') : value;
    case 'Checkbox':
      return value ? 'Yes' : 'No';
    case 'Lookup (Relationship)':
      // Handle lookup fields (populated objects)
      if (typeof value === 'object' && value !== null && value._id) {
        // Try common display fields
        return value.name || value.title || value.firstName || value.first_name || value.label || value._id;
      }
      return value;
    default:
      return value;
  }
};

/**
 * Get all key field values for a record
 * @param {Object} moduleDefinition - The module definition object
 * @param {Object} record - The record data
 * @returns {Array} Array of { fieldDef, value, label } objects
 */
export const getKeyFieldValues = (moduleDefinition, record) => {
  const keyFields = getKeyFields(moduleDefinition);
  return keyFields.map(fieldDef => ({
    fieldDef,
    value: getFieldValue(fieldDef, record),
    label: fieldDef.label || fieldDef.key
  }));
};

