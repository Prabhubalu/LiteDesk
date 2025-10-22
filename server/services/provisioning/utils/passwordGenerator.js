const crypto = require('crypto');

/**
 * Generate a secure random password
 * @param {number} length - Password length (default: 16)
 * @param {object} options - Password options
 * @returns {string} - Generated password
 */
function generateSecurePassword(length = 16, options = {}) {
  const defaults = {
    includeLowercase: true,
    includeUppercase: true,
    includeNumbers: true,
    includeSymbols: true,
    excludeAmbiguous: true  // Exclude 0, O, l, I, etc.
  };
  
  const opts = { ...defaults, ...options };
  
  let charset = '';
  
  if (opts.includeLowercase) {
    charset += opts.excludeAmbiguous ? 'abcdefghjkmnpqrstuvwxyz' : 'abcdefghijklmnopqrstuvwxyz';
  }
  
  if (opts.includeUppercase) {
    charset += opts.excludeAmbiguous ? 'ABCDEFGHJKLMNPQRSTUVWXYZ' : 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  }
  
  if (opts.includeNumbers) {
    charset += opts.excludeAmbiguous ? '23456789' : '0123456789';
  }
  
  if (opts.includeSymbols) {
    charset += '!@#$%^&*-_=+';
  }
  
  if (!charset) {
    throw new Error('At least one character type must be included');
  }
  
  let password = '';
  const randomBytes = crypto.randomBytes(length * 2);
  
  for (let i = 0; i < length; i++) {
    const randomIndex = randomBytes[i] % charset.length;
    password += charset[randomIndex];
  }
  
  return password;
}

/**
 * Generate a MongoDB connection string password
 * @returns {string} - Generated password (alphanumeric only for safety)
 */
function generateDatabasePassword() {
  return generateSecurePassword(32, {
    includeLowercase: true,
    includeUppercase: true,
    includeNumbers: true,
    includeSymbols: false,  // No symbols for database passwords
    excludeAmbiguous: true
  });
}

/**
 * Generate a JWT secret
 * @returns {string} - Generated JWT secret
 */
function generateJWTSecret() {
  return crypto.randomBytes(64).toString('hex');
}

module.exports = {
  generateSecurePassword,
  generateDatabasePassword,
  generateJWTSecret
};

