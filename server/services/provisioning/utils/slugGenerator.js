const InstanceRegistry = require('../../../models/InstanceRegistry');

/**
 * Generate a unique subdomain slug from company name
 * @param {string} companyName - The company name
 * @returns {Promise<string>} - Unique subdomain slug
 */
async function generateUniqueSlug(companyName) {
  // Convert to lowercase and remove special characters
  let baseSlug = companyName
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')  // Remove special chars
    .replace(/\s+/g, '-')           // Replace spaces with hyphens
    .replace(/-+/g, '-')            // Replace multiple hyphens with single
    .replace(/^-|-$/g, '');         // Remove leading/trailing hyphens
  
  // Limit length
  baseSlug = baseSlug.substring(0, 30);
  
  // Check if slug exists
  let slug = baseSlug;
  let counter = 1;
  
  while (await slugExists(slug)) {
    slug = `${baseSlug}-${counter}`;
    counter++;
    
    // Prevent infinite loop
    if (counter > 100) {
      slug = `${baseSlug}-${Date.now()}`;
      break;
    }
  }
  
  return slug;
}

/**
 * Check if a subdomain slug already exists
 * @param {string} slug - The subdomain slug to check
 * @returns {Promise<boolean>} - True if exists, false otherwise
 */
async function slugExists(slug) {
  const existing = await InstanceRegistry.findOne({ subdomain: slug });
  return !!existing;
}

/**
 * Validate subdomain slug format
 * @param {string} slug - The subdomain slug to validate
 * @returns {boolean} - True if valid, false otherwise
 */
function isValidSlug(slug) {
  // Must be 3-30 characters, lowercase alphanumeric and hyphens only
  const slugRegex = /^[a-z0-9]([a-z0-9-]{1,28}[a-z0-9])?$/;
  return slugRegex.test(slug);
}

module.exports = {
  generateUniqueSlug,
  slugExists,
  isValidSlug
};

