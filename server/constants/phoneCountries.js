/** ISO 3166-1 alpha-2 codes supported by client PhoneInput — keep in sync with client/src/utils/phoneInput.js */
const PHONE_COUNTRY_ISO2 = [
  'US', 'CA', 'GB', 'IN', 'AU', 'NZ', 'SG', 'AE', 'DE', 'FR', 'IT', 'ES', 'NL', 'SE', 'CH',
  'JP', 'KR', 'CN', 'BR', 'MX', 'ZA', 'NG', 'KE', 'SA', 'PK', 'BD',
];

const PHONE_COUNTRY_ISO2_SET = new Set(PHONE_COUNTRY_ISO2);

function isValidPhoneCountryIso2(value) {
  if (!value || typeof value !== 'string') return false;
  return PHONE_COUNTRY_ISO2_SET.has(value.trim().toUpperCase());
}

module.exports = {
  PHONE_COUNTRY_ISO2,
  isValidPhoneCountryIso2,
};
