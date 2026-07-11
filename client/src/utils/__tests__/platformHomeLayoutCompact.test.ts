import { describe, expect, it } from 'vitest';
import type { PlatformHomeLayoutItem } from '@/types/platformHome.types';
import {
  compactPlatformHomeLayoutItems,
  nextPlatformHomeLayoutY,
} from '@/utils/platformHomeWidgetRegistry';

function item(
  overrides: Partial<PlatformHomeLayoutItem> & Pick<PlatformHomeLayoutItem, 'instanceId' | 'type'>,
): PlatformHomeLayoutItem {
  return {
    widgetId: null,
    enabled: true,
    x: 0,
    y: 0,
    w: 12,
    h: 2,
    ...overrides,
  };
}

describe('compactPlatformHomeLayoutItems', () => {
  it('removes vertical gap left by a disabled widget', () => {
    const items = [
      item({ instanceId: 'intent-bar', type: 'intent-bar', y: 0, h: 2 }),
      item({ instanceId: 'today-brief', type: 'today-brief', y: 2, h: 2 }),
      item({ instanceId: 'alerts', type: 'alerts', y: 4, h: 2, enabled: false }),
      item({ instanceId: 'apps', type: 'apps', y: 6, h: 2 }),
    ];

    const compacted = compactPlatformHomeLayoutItems(items);
    const apps = compacted.find((entry) => entry.instanceId === 'apps');

    expect(apps?.y).toBe(4);
  });

  it('preserves side-by-side widgets on the same row', () => {
    const items = [
      item({ instanceId: 'up-next', type: 'up-next', y: 0, w: 6, h: 5 }),
      item({ instanceId: 'recent-work', type: 'recent-work', x: 6, y: 0, w: 6, h: 5 }),
    ];

    const compacted = compactPlatformHomeLayoutItems(items);

    expect(compacted.find((entry) => entry.instanceId === 'up-next')?.y).toBe(0);
    expect(compacted.find((entry) => entry.instanceId === 'recent-work')?.y).toBe(0);
  });

  it('places new widgets after compacted enabled items', () => {
    const items = [
      item({ instanceId: 'intent-bar', type: 'intent-bar', y: 0, h: 2 }),
      item({ instanceId: 'today-brief', type: 'today-brief', y: 2, h: 2 }),
      item({ instanceId: 'alerts', type: 'alerts', y: 4, h: 2, enabled: false }),
      item({ instanceId: 'apps', type: 'apps', y: 6, h: 2 }),
    ];

    expect(nextPlatformHomeLayoutY(items)).toBe(6);
  });
});
