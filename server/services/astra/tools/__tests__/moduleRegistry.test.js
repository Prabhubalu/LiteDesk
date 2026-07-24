'use strict';

/**
 * CI gate: every required ModuleDefinition key must exist in Astra MODULES.
 */

const {
  assertModuleRegistryComplete,
  REQUIRED_PLATFORM_MODULE_KEYS,
  listModules,
  getModule,
} = require('../moduleCatalog');

describe('Astra module registry completeness', () => {
  it('includes every required platform moduleKey', () => {
    expect(() => assertModuleRegistryComplete()).not.toThrow();
  });

  it('lists ready or explicit unsupported for each required key', () => {
    for (const key of REQUIRED_PLATFORM_MODULE_KEYS) {
      const mod = getModule(key);
      expect(mod).toBeTruthy();
      expect(['ready', 'unsupported']).toContain(mod.support);
      if (mod.support === 'ready') {
        expect(mod.model).toBeTruthy();
      }
    }
  });

  it('exposes invoices and payments as ready', () => {
    expect(getModule('invoices')?.support).toBe('ready');
    expect(getModule('payments')?.support).toBe('ready');
    expect(getModule('refunds')?.support).toBe('ready');
  });

  it('coverage report counts modules', () => {
    const list = listModules();
    expect(list.length).toBeGreaterThanOrEqual(REQUIRED_PLATFORM_MODULE_KEYS.length);
  });
});
