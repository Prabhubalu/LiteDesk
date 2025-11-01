/**
 * Validates a field value against its validation rules
 * @param {*} value - The value to validate
 * @param {Array} validations - Array of validation rules
 * @returns {Object} - { isValid: boolean, error: string|null }
 */
export function validateField(value, validations) {
  if (!validations || !Array.isArray(validations) || validations.length === 0) {
    return { isValid: true, error: null };
  }

  // Convert value to string for validation (handles null/undefined)
  const stringValue = value === null || value === undefined ? '' : String(value);
  const numValue = typeof value === 'number' ? value : parseFloat(value);

  // Check each validation rule
  for (const validation of validations) {
    if (!validation.type) continue;

    let isValid = true;
    let error = validation.message || 'Validation failed';

    switch (validation.type) {
      case 'regex':
        if (validation.pattern) {
          try {
            const regex = new RegExp(validation.pattern);
            isValid = regex.test(stringValue);
          } catch (e) {
            console.error('Invalid regex pattern:', validation.pattern, e);
            isValid = true; // Don't block on invalid regex
          }
        }
        break;

      case 'length':
        const length = stringValue.length;
        if (validation.minLength !== undefined && length < validation.minLength) {
          isValid = false;
          error = validation.message || `Minimum length is ${validation.minLength} characters`;
        }
        if (validation.maxLength !== undefined && length > validation.maxLength) {
          isValid = false;
          error = validation.message || `Maximum length is ${validation.maxLength} characters`;
        }
        break;

      case 'range':
        if (isNaN(numValue)) {
          isValid = false;
          error = validation.message || 'Must be a number';
        } else {
          if (validation.min !== undefined && numValue < validation.min) {
            isValid = false;
            error = validation.message || `Minimum value is ${validation.min}`;
          }
          if (validation.max !== undefined && numValue > validation.max) {
            isValid = false;
            error = validation.message || `Maximum value is ${validation.max}`;
          }
        }
        break;

      case 'picklist_single':
        if (stringValue && validation.allowedValues && Array.isArray(validation.allowedValues)) {
          isValid = validation.allowedValues.includes(stringValue);
          if (!isValid) {
            error = validation.message || `Value must be one of: ${validation.allowedValues.join(', ')}`;
          }
        }
        break;

      case 'picklist_multi':
        if (Array.isArray(value)) {
          const invalidValues = value.filter(v => 
            !validation.allowedValues || !validation.allowedValues.includes(String(v))
          );
          isValid = invalidValues.length === 0;
          if (!isValid) {
            error = validation.message || `All values must be from: ${validation.allowedValues?.join(', ')}`;
          }
        } else if (value) {
          isValid = validation.allowedValues && validation.allowedValues.includes(String(value));
          if (!isValid) {
            error = validation.message || `Value must be one of: ${validation.allowedValues.join(', ')}`;
          }
        }
        break;

      case 'email':
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (stringValue) {
          isValid = emailRegex.test(stringValue);
          if (!isValid) {
            error = validation.message || 'Invalid email format';
          }
        }
        break;

      default:
        isValid = true;
    }

    // If validation fails, return error immediately
    if (!isValid) {
      return { isValid: false, error };
    }
  }

  return { isValid: true, error: null };
}

