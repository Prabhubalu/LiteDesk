const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { resolveUploadLogoPath } = require('../../services/quoteBrandingService');
const { uploadsDir } = require('../../middleware/uploadMiddleware');

test('resolveUploadLogoPath returns path for org upload', () => {
  const orgId = 'test-org-logo';
  const dir = path.join(uploadsDir, orgId);
  fs.mkdirSync(dir, { recursive: true });
  const filename = 'logo-test.png';
  const filePath = path.join(dir, filename);
  fs.writeFileSync(filePath, Buffer.from([0x89, 0x50, 0x4e, 0x47]));

  const resolved = resolveUploadLogoPath(`/api/uploads/${orgId}/${filename}`, orgId);
  assert.equal(resolved, filePath);

  fs.unlinkSync(filePath);
  try {
    fs.rmdirSync(dir);
  } catch {
    /* ignore */
  }
});

test('resolveUploadLogoPath rejects path traversal', () => {
  assert.equal(resolveUploadLogoPath('/api/uploads/org1/../secret.png', 'org1'), null);
});

test('resolveUploadLogoPath rejects svg', () => {
  assert.equal(resolveUploadLogoPath('/api/uploads/org1/logo.svg', 'org1'), null);
});
