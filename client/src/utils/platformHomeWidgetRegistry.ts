import type {
  PlatformHomeBuiltinWidgetDefinition,
  PlatformHomeLayout,
  PlatformHomeLayoutItem,
  PlatformHomeWidthMode,
} from '@/types/platformHome.types';

export const PLATFORM_HOME_WIDGET_MIN_W = 2;
export const PLATFORM_HOME_WIDGET_MIN_H = 2;

export const PLATFORM_HOME_WIDTH_MODES: PlatformHomeWidthMode[] = ['compact', 'wide'];

export const PLATFORM_HOME_WIDTH_CLASS: Record<PlatformHomeWidthMode, string> = {
  compact: 'max-w-4xl',
  wide: 'max-w-7xl',
};

export const DEFAULT_PLATFORM_HOME_WIDTH_MODE: PlatformHomeWidthMode = 'wide';

export const PLATFORM_HOME_BUILTIN_WIDGETS: PlatformHomeBuiltinWidgetDefinition[] = [
  { type: 'intent-bar', labelKey: 'platform.platformHomeWidgetIntentBar', defaultW: 12, defaultH: 2, minW: PLATFORM_HOME_WIDGET_MIN_W, minH: PLATFORM_HOME_WIDGET_MIN_H },
  { type: 'today-brief', labelKey: 'platform.platformHomeWidgetTodayBrief', defaultW: 12, defaultH: 2, minW: PLATFORM_HOME_WIDGET_MIN_W, minH: PLATFORM_HOME_WIDGET_MIN_H },
  { type: 'alerts', labelKey: 'platform.platformHomeWidgetAlerts', defaultW: 12, defaultH: 2, minW: PLATFORM_HOME_WIDGET_MIN_W, minH: PLATFORM_HOME_WIDGET_MIN_H },
  { type: 'apps', labelKey: 'platform.platformHomeYourApps', defaultW: 12, defaultH: 2, minW: PLATFORM_HOME_WIDGET_MIN_W, minH: PLATFORM_HOME_WIDGET_MIN_H },
  { type: 'up-next', labelKey: 'platform.platformHomeUpNext', defaultW: 6, defaultH: 5, minW: PLATFORM_HOME_WIDGET_MIN_W, minH: PLATFORM_HOME_WIDGET_MIN_H },
  { type: 'recent-work', labelKey: 'platform.platformHomeRecentWork', defaultW: 6, defaultH: 5, minW: PLATFORM_HOME_WIDGET_MIN_W, minH: PLATFORM_HOME_WIDGET_MIN_H },
  { type: 'inbox', labelKey: 'platform.platformHomeInboxTitle', defaultW: 12, defaultH: 4, minW: PLATFORM_HOME_WIDGET_MIN_W, minH: PLATFORM_HOME_WIDGET_MIN_H },
];

function createBuiltinItem(
  def: PlatformHomeBuiltinWidgetDefinition,
  y: number,
): PlatformHomeLayoutItem {
  return {
    instanceId: def.type,
    type: def.type,
    enabled: true,
    x: def.type === 'recent-work' ? 6 : 0,
    y,
    w: def.defaultW,
    h: def.defaultH,
    minW: def.minW,
    minH: def.minH,
  };
}

export function createDefaultPlatformHomeLayout(): PlatformHomeLayout {
  const items: PlatformHomeLayoutItem[] = [];
  let y = 0;
  let workspaceRowY: number | null = null;

  for (const def of PLATFORM_HOME_BUILTIN_WIDGETS) {
    if (def.type === 'up-next') {
      workspaceRowY = y;
    }

    const itemY = def.type === 'recent-work' && workspaceRowY !== null ? workspaceRowY : y;
    items.push(createBuiltinItem(def, itemY));

    if (def.type === 'up-next') {
      y += def.defaultH;
      continue;
    }
    if (def.type === 'recent-work') {
      continue;
    }
    y += def.defaultH;
  }

  return { items, widthMode: DEFAULT_PLATFORM_HOME_WIDTH_MODE };
}

function normalizePlatformHomeWidthMode(raw: unknown): PlatformHomeWidthMode {
  const mode = String(raw || DEFAULT_PLATFORM_HOME_WIDTH_MODE).trim();
  return PLATFORM_HOME_WIDTH_MODES.includes(mode as PlatformHomeWidthMode)
    ? (mode as PlatformHomeWidthMode)
    : DEFAULT_PLATFORM_HOME_WIDTH_MODE;
}

export function normalizePlatformHomeLayout(raw: unknown): PlatformHomeLayout {
  const widthMode = raw && typeof raw === 'object'
    ? normalizePlatformHomeWidthMode((raw as PlatformHomeLayout).widthMode)
    : DEFAULT_PLATFORM_HOME_WIDTH_MODE;

  if (!raw || typeof raw !== 'object') {
    return { ...createDefaultPlatformHomeLayout(), widthMode };
  }

  const itemsRaw = (raw as PlatformHomeLayout).items;
  if (!Array.isArray(itemsRaw) || itemsRaw.length === 0) {
    return { ...createDefaultPlatformHomeLayout(), widthMode };
  }

  const builtinTypes = new Set<string>(PLATFORM_HOME_BUILTIN_WIDGETS.map((def) => def.type));
  const items: PlatformHomeLayoutItem[] = [];

  for (const entry of itemsRaw) {
    if (!entry || typeof entry !== 'object') continue;
    const type = String(entry.type || '');
    if (!type) continue;

    if (type !== 'analytics' && !builtinTypes.has(type)) {
      continue;
    }

    if (type === 'analytics' && !entry.widgetId) continue;

    const normalizedItem: PlatformHomeLayoutItem = {
      instanceId: String(entry.instanceId || (type === 'analytics' ? crypto.randomUUID() : type)),
      type: type as PlatformHomeLayoutItem['type'],
      widgetId: type === 'analytics' ? String(entry.widgetId) : null,
      enabled: entry.enabled !== false,
      x: Number(entry.x) || 0,
      y: Number(entry.y) || 0,
      w: Number(entry.w) || 6,
      h: Number(entry.h) || 3,
    };
    const constraints = resolvePlatformHomeItemConstraints(normalizedItem);
    items.push({
      ...normalizedItem,
      minW: constraints.minW,
      minH: constraints.minH,
    });
  }

  if (items.length === 0) {
    return { ...createDefaultPlatformHomeLayout(), widthMode };
  }

  return { items: compactPlatformHomeLayoutItems(items), widthMode };
}

export function clonePlatformHomeLayout(layout: PlatformHomeLayout): PlatformHomeLayout {
  return {
    items: layout.items.map((item) => ({ ...item })),
    widthMode: layout.widthMode ?? DEFAULT_PLATFORM_HOME_WIDTH_MODE,
  };
}

function layoutItemsCollide(
  a: Pick<PlatformHomeLayoutItem, 'x' | 'y' | 'w' | 'h'>,
  ax: number,
  ay: number,
  b: Pick<PlatformHomeLayoutItem, 'x' | 'y' | 'w' | 'h'>,
): boolean {
  return !(
    ax + a.w <= b.x
    || ax >= b.x + b.w
    || ay + a.h <= b.y
    || ay >= b.y + b.h
  );
}

/** Pack enabled widgets upward to remove vertical gaps (mirrors GridStack compact). */
export function compactPlatformHomeLayoutItems(
  items: PlatformHomeLayoutItem[],
): PlatformHomeLayoutItem[] {
  const enabled = items.filter((item) => item.enabled !== false);
  const compacted = [...enabled]
    .sort((a, b) => a.y - b.y || a.x - b.x)
    .map((item) => ({ ...item }));

  for (const item of compacted) {
    let nextY = item.y;
    while (nextY > 0) {
      const testY = nextY - 1;
      const blocked = compacted.some(
        (other) => other.instanceId !== item.instanceId
          && layoutItemsCollide(item, item.x, testY, other),
      );
      if (blocked) break;
      nextY = testY;
    }
    item.y = nextY;
  }

  const compactedById = new Map(compacted.map((item) => [item.instanceId, item]));
  return items.map((item) => compactedById.get(item.instanceId) ?? item);
}

export function nextPlatformHomeLayoutY(items: PlatformHomeLayoutItem[]): number {
  const compacted = compactPlatformHomeLayoutItems(items);
  return compacted
    .filter((item) => item.enabled !== false)
    .reduce((max, item) => Math.max(max, item.y + item.h), 0);
}

export function getBuiltinWidgetDefinition(type: string) {
  return PLATFORM_HOME_BUILTIN_WIDGETS.find((def) => def.type === type) || null;
}

export function resolvePlatformHomeItemConstraints(item: PlatformHomeLayoutItem): {
  minW: number;
  minH: number;
} {
  const def = item.type !== 'analytics' ? getBuiltinWidgetDefinition(item.type) : null;
  return {
    minW: def?.minW ?? PLATFORM_HOME_WIDGET_MIN_W,
    minH: def?.minH ?? PLATFORM_HOME_WIDGET_MIN_H,
  };
}
