import type { Component } from 'vue';
import * as OutlineIcons from '@heroicons/vue/24/outline';
import {
  DEFAULT_HERO_ICON_COLOR,
  HEROICON_COMPONENT_MAP,
  HEROICON_IDS,
  HEROICON_ID_SET,
  HERO_ICON_COLOR_PRESETS,
  type HeroiconId,
} from '@/generated/heroiconCatalog';

export {
  DEFAULT_HERO_ICON_COLOR,
  HEROICON_IDS,
  HEROICON_ID_SET,
  HERO_ICON_COLOR_PRESETS,
  type HeroiconId,
};

export interface HeroiconOption {
  key: HeroiconId;
  label: string;
  component: Component;
}

export function humanizeHeroiconId(iconId: string): string {
  return String(iconId || '')
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function normalizeHeroiconId(value: string | null | undefined): HeroiconId | '' {
  const key = String(value || '').trim().toLowerCase();
  return HEROICON_ID_SET.has(key) ? (key as HeroiconId) : '';
}

export function normalizeHeroiconColor(value: string | null | undefined): string {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^#[0-9a-f]{6}$/i.test(raw)) return raw.toLowerCase();
  if (/^#[0-9a-f]{3}$/i.test(raw)) {
    const hex = raw.slice(1);
    return `#${hex.split('').map((ch) => ch + ch).join('')}`.toLowerCase();
  }
  return '';
}

export function resolveHeroiconComponent(key: string | null | undefined): Component {
  const normalized = normalizeHeroiconId(key);
  if (!normalized) return OutlineIcons.Squares2X2Icon;
  const componentName = HEROICON_COMPONENT_MAP[normalized];
  if (!componentName) return OutlineIcons.Squares2X2Icon;
  const component = (OutlineIcons as Record<string, Component>)[componentName];
  return component || OutlineIcons.Squares2X2Icon;
}

export function resolveHeroiconOption(key: string | null | undefined): HeroiconOption | null {
  const normalized = normalizeHeroiconId(key);
  if (!normalized) return null;
  return {
    key: normalized,
    label: humanizeHeroiconId(normalized),
    component: resolveHeroiconComponent(normalized),
  };
}

export const HEROICON_OPTIONS: HeroiconOption[] = HEROICON_IDS.map((key) => ({
  key,
  label: humanizeHeroiconId(key),
  component: resolveHeroiconComponent(key),
}));
