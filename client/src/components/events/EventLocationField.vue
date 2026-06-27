<template>
  <div class="space-y-3">
    <div ref="searchRootRef" class="relative">
      <input
        :id="inputId"
        v-model="query"
        type="text"
        maxlength="1024"
        :disabled="disabled"
        :placeholder="placeholder || t('events.eventLocationSearchPlaceholder')"
        autocomplete="off"
        class="block w-full rounded-md bg-gray-100 dark:bg-gray-700 px-3 py-2 text-gray-900 dark:text-white text-base outline-1 -outline-offset-1 outline-gray-300/20 placeholder:text-gray-500 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-500 sm:text-sm/6 dark:focus:bg-gray-800 dark:outline-white/10 dark:placeholder:text-gray-500 dark:focus:outline-indigo-500"
        :class="error ? 'border border-red-500 dark:border-red-500' : ''"
        @focus="onInputFocus"
        @keydown.escape.prevent="closeSuggestions"
      />

      <ul
        v-if="showSuggestions"
        class="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-md border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-600 dark:bg-gray-800"
      >
        <li
          v-if="searchLoading"
          class="px-3 py-2 text-sm text-gray-500 dark:text-gray-400"
        >
          {{ t('events.eventLocationLoadingSuggestions') }}
        </li>
        <li
          v-else-if="!suggestions.length"
          class="px-3 py-2 text-sm text-gray-500 dark:text-gray-400"
        >
          {{ t('events.eventLocationNoResults') }}
        </li>
        <li v-for="(item, index) in suggestions" :key="`${item.latitude}-${item.longitude}-${index}`">
          <button
            type="button"
            class="w-full px-3 py-2 text-left text-sm text-gray-900 hover:bg-gray-100 dark:text-gray-100 dark:hover:bg-gray-700"
            @mousedown.prevent="selectSuggestion(item)"
          >
            {{ item.label }}
          </button>
        </li>
      </ul>
    </div>

    <button
      v-if="showOrgAddressAction"
      type="button"
      class="inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300 dark:hover:bg-indigo-900/50"
      :disabled="disabled || orgAddressLoading"
      @click="applyOrganizationAddress"
    >
      {{ t('events.eventLocationUseOrgAddress') }}
    </button>

    <p
      v-if="geoRequired && !hasCoordinates && !isMeetingUrl"
      class="text-xs text-amber-700 dark:text-amber-300"
    >
      {{ t('events.eventLocationSelectOrSearch') }}
    </p>
    <p
      v-else-if="hasCoordinates"
      class="text-xs text-emerald-700 dark:text-emerald-300"
    >
      {{ t('events.eventLocationVerified') }}
    </p>

    <div v-if="showMap" class="relative z-0 space-y-2">
      <div
        ref="mapContainerRef"
        class="event-location-map relative isolate h-44 w-full overflow-hidden rounded-lg border border-gray-200 dark:border-gray-600"
      />
      <p v-if="mapError" class="text-xs text-gray-500 dark:text-gray-400">
        {{ t('events.eventLocationMapLoadError') }}
      </p>
      <p v-else-if="hasCoordinates" class="text-xs text-gray-500 dark:text-gray-400">
        {{ t('events.eventLocationPinSet') }}
      </p>

      <div v-if="geoRequired && hasCoordinates" class="flex items-center gap-3">
        <input
          v-model.number="radius"
          type="range"
          min="25"
          max="500"
          step="25"
          :disabled="disabled"
          class="flex-1 accent-indigo-600"
          @input="onRadiusChange"
        />
        <span class="text-xs font-medium tabular-nums text-gray-700 dark:text-gray-300">
          {{ t('events.eventLocationGeofenceRadius', { meters: radius }) }}
        </span>
      </div>
    </div>

    <p v-if="error" class="text-sm text-red-600 dark:text-red-400">{{ error }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import apiClient from '@/utils/apiClient';
import { reverseGeocode, searchLocations } from '@/utils/geocodingService';
import { loadLeaflet } from '@/utils/leafletLoader';
import { isMeetingUrlLocation } from '@/utils/eventUtils';
import {
  createEmptyGeoLocation,
  DEFAULT_GEO_RADIUS_METERS,
  hasGeoCoordinates,
  type EventGeoLocation,
  type GeocodeSuggestion,
} from '@/types/eventLocation.types';

const props = withDefaults(
  defineProps<{
    location: string;
    geoLocation?: EventGeoLocation | null;
    geoRequired?: boolean;
    relatedToId?: string | null;
    disabled?: boolean;
    error?: string | null;
    placeholder?: string;
    inputId?: string;
  }>(),
  {
    geoLocation: null,
    geoRequired: false,
    relatedToId: null,
    disabled: false,
    error: null,
    placeholder: '',
    inputId: 'event-location',
  }
);

const emit = defineEmits<{
  'update:location': [value: string];
  'update:geoLocation': [value: EventGeoLocation];
}>();

const { t } = useI18n();

const query = ref(props.location || '');
const suggestions = ref<GeocodeSuggestion[]>([]);
const searchLoading = ref(false);
const suggestionsOpen = ref(false);
const orgAddressLoading = ref(false);
const orgAddress = ref<string | null>(null);
const mapError = ref(false);
const searchRootRef = ref<HTMLElement | null>(null);
const mapContainerRef = ref<HTMLElement | null>(null);

let searchTimer: ReturnType<typeof setTimeout> | null = null;
let map: {
  setView: (center: [number, number], zoom: number) => void;
  getZoom: () => number;
  invalidateSize: () => void;
  removeLayer: (layer: unknown) => void;
  remove: () => void;
} | null = null;
let marker: {
  getLatLng: () => { lat: number; lng: number };
  on: (event: string, handler: () => void) => void;
} | null = null;
let radiusCircle: unknown = null;
let reverseTimer: ReturnType<typeof setTimeout> | null = null;
let suppressQueryWatch = false;

const radius = ref(
  props.geoLocation?.radius && props.geoLocation.radius > 0
    ? props.geoLocation.radius
    : DEFAULT_GEO_RADIUS_METERS
);

const hasCoordinates = computed(() => hasGeoCoordinates(props.geoLocation));
const isMeetingUrl = computed(() => isMeetingUrlLocation(query.value));
const showMap = computed(() => props.geoRequired && hasCoordinates.value && !isMeetingUrl.value);
const showSuggestions = computed(() => suggestionsOpen.value && query.value.trim().length >= 3 && !isMeetingUrl.value);
const showOrgAddressAction = computed(() => Boolean(props.relatedToId && orgAddress.value && !props.disabled));

function closeSuggestions() {
  suggestionsOpen.value = false;
}

function onInputFocus() {
  if (query.value.trim().length >= 3 && !isMeetingUrl.value) {
    suggestionsOpen.value = true;
  }
}

function emitGeoPatch(patch: Partial<EventGeoLocation>) {
  const base = props.geoLocation ?? createEmptyGeoLocation(radius.value);
  emit('update:geoLocation', {
    ...base,
    ...patch,
    radius: patch.radius ?? base.radius ?? radius.value,
  });
}

function emitLocation(value: string) {
  emit('update:location', value);
}

function scheduleSearch(value: string) {
  if (searchTimer) clearTimeout(searchTimer);
  const trimmed = value.trim();
  if (trimmed.length < 3 || isMeetingUrlLocation(trimmed)) {
    suggestions.value = [];
    searchLoading.value = false;
    return;
  }

  searchLoading.value = true;
  searchTimer = setTimeout(async () => {
    try {
      suggestions.value = await searchLocations(trimmed);
    } catch {
      suggestions.value = [];
    } finally {
      searchLoading.value = false;
    }
  }, 300);
}

function selectSuggestion(item: GeocodeSuggestion) {
  suppressQueryWatch = true;
  query.value = item.label;
  emitLocation(item.label);
  emitGeoPatch({
    latitude: item.latitude,
    longitude: item.longitude,
    address: item.label,
  });
  suggestions.value = [];
  suggestionsOpen.value = false;
  suppressQueryWatch = false;
}

async function applyOrganizationAddress() {
  if (!orgAddress.value) return;
  suppressQueryWatch = true;
  query.value = orgAddress.value;
  emitLocation(orgAddress.value);
  suppressQueryWatch = false;
  scheduleSearch(orgAddress.value);

  try {
    const results = await searchLocations(orgAddress.value, 1);
    if (results[0]) {
      selectSuggestion(results[0]);
    }
  } catch {
    // Keep text-only location if geocode fails
  }
}

async function fetchOrganizationAddress(orgId: string) {
  orgAddressLoading.value = true;
  try {
    const response = await apiClient.get(`/v2/organization/${orgId}`);
    const record = (response as { data?: { address?: string } })?.data ?? response;
    const address = typeof record?.address === 'string' ? record.address.trim() : '';
    orgAddress.value = address || null;
  } catch {
    orgAddress.value = null;
  } finally {
    orgAddressLoading.value = false;
  }
}

function onRadiusChange() {
  emitGeoPatch({ radius: radius.value });
  updateRadiusCircle();
}

function clearMapLayers() {
  if (!map) return;
  if (marker) {
    map.removeLayer(marker);
    marker = null;
  }
  if (radiusCircle) {
    map.removeLayer(radiusCircle);
    radiusCircle = null;
  }
}

function updateRadiusCircle() {
  if (!map || !window.L || !props.geoLocation?.latitude || !props.geoLocation?.longitude) return;
  const L = window.L;
  const center: [number, number] = [props.geoLocation.latitude, props.geoLocation.longitude];

  if (radiusCircle) {
    map.removeLayer(radiusCircle);
  }

  radiusCircle = L.circle(center, {
    radius: radius.value,
    color: '#4f46e5',
    fillColor: '#4f46e5',
    fillOpacity: 0.12,
  }).addTo(map);
}

async function syncMap() {
  if (!showMap.value) {
    if (map) {
      map.remove();
      map = null;
      marker = null;
      radiusCircle = null;
    }
    return;
  }

  await nextTick();
  if (!mapContainerRef.value || !props.geoLocation?.latitude || !props.geoLocation?.longitude) return;

  try {
    await loadLeaflet();
    mapError.value = false;
  } catch {
    mapError.value = true;
    return;
  }

  const L = window.L;
  if (!L) {
    mapError.value = true;
    return;
  }

  const center: [number, number] = [props.geoLocation.latitude, props.geoLocation.longitude];

  if (!map) {
    map = L.map(mapContainerRef.value, { zoomControl: true });
    map.setView(center, 16);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);
  } else {
    map.setView(center, map.getZoom());
  }

  clearMapLayers();

  marker = L.marker(center, { draggable: !props.disabled }).addTo(map);
  marker.on('dragend', () => {
    const latLng = marker?.getLatLng();
    if (!latLng) return;

    if (reverseTimer) clearTimeout(reverseTimer);
    reverseTimer = setTimeout(async () => {
      const reversed = await reverseGeocode(latLng.lat, latLng.lng);
      const label = reversed?.label ?? `${latLng.lat.toFixed(5)}, ${latLng.lng.toFixed(5)}`;
      suppressQueryWatch = true;
      query.value = label;
      emitLocation(label);
      suppressQueryWatch = false;
      emitGeoPatch({
        latitude: latLng.lat,
        longitude: latLng.lng,
        address: label,
      });
    }, 250);
  });

  updateRadiusCircle();

  setTimeout(() => {
    map?.invalidateSize();
  }, 100);
}

function onDocumentClick(event: MouseEvent) {
  if (!searchRootRef.value?.contains(event.target as Node)) {
    closeSuggestions();
  }
}

watch(
  () => props.location,
  (value) => {
    if (suppressQueryWatch) return;
    if (value !== query.value) {
      query.value = value || '';
    }
  }
);

watch(query, (value) => {
  if (suppressQueryWatch) return;

  emitLocation(value);

  if (isMeetingUrlLocation(value)) {
    emitGeoPatch(createEmptyGeoLocation(radius.value));
    suggestions.value = [];
    closeSuggestions();
    return;
  }

  if (!value.trim()) {
    emitGeoPatch(createEmptyGeoLocation(radius.value));
  } else if (hasCoordinates.value && value.trim() !== (props.geoLocation?.address || props.location)) {
    emitGeoPatch({
      latitude: null,
      longitude: null,
      address: value.trim(),
    });
  }

  scheduleSearch(value);
  if (value.trim().length >= 3) {
    suggestionsOpen.value = true;
  }
});

watch(
  () => props.relatedToId,
  (orgId) => {
    orgAddress.value = null;
    if (orgId) {
      fetchOrganizationAddress(String(orgId));
    }
  },
  { immediate: true }
);

watch(
  () => [props.geoRequired, props.geoLocation?.latitude, props.geoLocation?.longitude, props.geoLocation?.radius] as const,
  () => {
    if (props.geoLocation?.radius && props.geoLocation.radius !== radius.value) {
      radius.value = props.geoLocation.radius;
    }
    syncMap();
  },
  { deep: true }
);

watch(showMap, () => {
  syncMap();
});

onMounted(() => {
  document.addEventListener('mousedown', onDocumentClick);
  if (props.location) {
    query.value = props.location;
  }
  syncMap();
});

onUnmounted(() => {
  document.removeEventListener('mousedown', onDocumentClick);
  if (searchTimer) clearTimeout(searchTimer);
  if (reverseTimer) clearTimeout(reverseTimer);
  if (map) {
    map.remove();
    map = null;
  }
});
</script>

<style scoped>
.event-location-map :deep(.leaflet-container) {
  font: inherit;
  z-index: 0 !important;
}

/* Keep map layers below form popovers (date pickers use z-50). */
.event-location-map :deep(.leaflet-pane),
.event-location-map :deep(.leaflet-top),
.event-location-map :deep(.leaflet-bottom) {
  z-index: 1 !important;
}

.event-location-map :deep(.leaflet-tile-pane) {
  z-index: 1 !important;
}

.event-location-map :deep(.leaflet-overlay-pane) {
  z-index: 2 !important;
}

.event-location-map :deep(.leaflet-shadow-pane) {
  z-index: 3 !important;
}

.event-location-map :deep(.leaflet-marker-pane) {
  z-index: 4 !important;
}

.event-location-map :deep(.leaflet-tooltip-pane) {
  z-index: 5 !important;
}

.event-location-map :deep(.leaflet-popup-pane) {
  z-index: 6 !important;
}

.event-location-map :deep(.leaflet-control) {
  z-index: 7 !important;
}
</style>
