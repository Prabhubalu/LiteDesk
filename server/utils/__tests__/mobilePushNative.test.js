const test = require('node:test');
const assert = require('node:assert/strict');

test('mobileDeviceController exports register/unregister helpers', () => {
  const ctrl = require('../../controllers/mobileDeviceController');
  assert.equal(typeof ctrl.registerDevice, 'function');
  assert.equal(typeof ctrl.unregisterDevice, 'function');
  assert.equal(typeof ctrl.getActiveDevices, 'function');
  assert.equal(typeof ctrl.markDeviceFailure, 'function');
  assert.equal(typeof ctrl.markDeviceSuccess, 'function');
});

test('nativePushService exports send helpers', () => {
  const svc = require('../../services/nativePushService');
  assert.equal(typeof svc.sendToUser, 'function');
  assert.equal(typeof svc.sendToDevice, 'function');
  assert.equal(typeof svc.initialized, 'function');
});

test('push routes include device registration paths', () => {
  const router = require('../../routes/pushRoutes');
  const stack = router.stack || [];
  const paths = stack
    .filter((layer) => layer.route)
    .map((layer) => `${Object.keys(layer.route.methods)[0].toUpperCase()} ${layer.route.path}`);
  assert.ok(paths.includes('POST /device'), `expected POST /device in ${paths.join(', ')}`);
  assert.ok(
    paths.includes('POST /device/unregister'),
    `expected POST /device/unregister in ${paths.join(', ')}`
  );
});
