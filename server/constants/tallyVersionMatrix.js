'use strict';

/**
 * Supported TallyPrime versions for the Arivu Connector Agent.
 * Keep aligned with docs/TALLY_SUPPORT_MATRIX.md.
 */

const SUPPORTED_TALLY_VERSIONS = Object.freeze([
  {
    id: 'tallyprime-3',
    product: 'TallyPrime',
    major: 3,
    label: 'TallyPrime 3.x',
    xmlApi: true,
    status: 'supported',
  },
  {
    id: 'tallyprime-4',
    product: 'TallyPrime',
    major: 4,
    label: 'TallyPrime 4.x',
    xmlApi: true,
    status: 'supported',
  },
]);

const SUPPORTED_MAJORS = Object.freeze(
  SUPPORTED_TALLY_VERSIONS.map((v) => v.major)
);

/**
 * @param {string|null|undefined} versionString — e.g. "TallyPrime 4.0", "TallyPrime Release 3.0.1"
 * @returns {boolean}
 */
function isSupportedTallyVersion(versionString) {
  if (versionString == null) return false;
  const raw = String(versionString).trim();
  if (!raw) return false;

  const lower = raw.toLowerCase();
  if (lower.includes('erp 9') || lower.includes('erp9') || lower.includes('tally.erp')) {
    return false;
  }

  if (!/tally\s*prime/i.test(raw) && !/^tallyprime/i.test(raw)) {
    return false;
  }

  const majorMatch = raw.match(/(?:release\s*)?(\d+)(?:\.\d+)*/i);
  if (!majorMatch) return false;
  const major = parseInt(majorMatch[1], 10);
  return SUPPORTED_MAJORS.includes(major);
}

module.exports = {
  SUPPORTED_TALLY_VERSIONS,
  isSupportedTallyVersion,
};
