<template>
  <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
    <h3 class="text-sm font-semibold text-gray-900 dark:text-white mb-4">{{ t('events.eventMapViewGpsTrackingMap') }}</h3>
    
    <div v-if="!mapLoaded" class="flex items-center justify-center h-64 bg-gray-100 dark:bg-gray-900 rounded-lg">
      <div class="text-center">
        <div class="w-12 h-12 border-4 border-gray-300 dark:border-gray-600 border-t-indigo-600 rounded-full animate-spin mx-auto mb-2"></div>
        <p class="text-sm text-gray-600 dark:text-gray-400">{{ t('events.eventMapViewLoadingMap') }}</p>
      </div>
    </div>
    
    <div ref="mapContainer" class="w-full h-64 rounded-lg overflow-hidden" v-show="mapLoaded"></div>
    
    <!-- Map Controls -->
    <div v-if="mapLoaded && trackingPoints.length > 0" class="mt-4 flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
      <div class="flex items-center gap-4">
        <div class="flex items-center gap-2">
          <div class="w-3 h-3 rounded-full bg-green-500"></div>
          <span>{{ t('events.eventMapViewCheckIn') }}</span>
        </div>
        <div class="flex items-center gap-2">
          <div class="w-3 h-3 rounded-full bg-red-500"></div>
          <span>{{ t('events.eventMapViewCheckOut') }}</span>
        </div>
        <div class="flex items-center gap-2">
          <div class="w-3 h-3 rounded-full bg-blue-500"></div>
          <span>{{ t('forms.comparisonCurrent') }}</span>
        </div>
      </div>
      <button
        @click="centerMap"
        class="px-3 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700 text-xs"
      >{{ t('events.eventMapViewCenterMap') }}</button>
    </div>
    
    <!-- No tracking data -->
    <div v-if="mapLoaded && trackingPoints.length === 0" class="text-center py-8 text-sm text-gray-500 dark:text-gray-400">{{ t('events.eventMapViewNoGpsTrackingDataAvailable') }}</div>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue';
import { formatUserDateTime } from '@/utils/localeFormat';

const props = defineProps({
  event: {
    type: Object,
    required: true
  },
  currentLocation: {
    type: Object,
    default: null
  }
});

const { t } = useI18n();

let map = null;
let markers = [];
let polyline = null;
const mapContainer = ref(null);
const mapLoaded = ref(false);

// Tracking points from event
const trackingPoints = ref([]);

// Initialize map
const initMap = () => {
  if (!mapContainer.value) return;
  
  // Use OpenStreetMap with Leaflet (free, no API key required)
  // For production, you might want to use Google Maps or Mapbox
  const L = window.L;
  
  if (!L) {
    // Load Leaflet CSS and JS dynamically
    loadLeaflet().then(() => {
      createMap();
    });
  } else {
    createMap();
  }
};

const loadLeaflet = () => {
  return new Promise((resolve) => {
    // Check if already loaded
    if (window.L && document.querySelector('link[href*="leaflet"]')) {
      resolve();
      return;
    }
    
    // Load CSS
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);
    
    // Load JS
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = resolve;
    document.head.appendChild(script);
  });
};

const createMap = () => {
  const L = window.L;
  if (!L || !mapContainer.value) return;
  
  // Determine center point
  let center = [0, 0];
  let zoom = 2;
  
  if (props.event.geoLocation?.latitude != null && props.event.geoLocation?.longitude != null) {
    center = [props.event.geoLocation.latitude, props.event.geoLocation.longitude];
    zoom = 15;
  } else if (props.event.checkIn?.location && props.event.checkIn.location.latitude != null && props.event.checkIn.location.longitude != null) {
    center = [props.event.checkIn.location.latitude, props.event.checkIn.location.longitude];
    zoom = 15;
  } else if (trackingPoints.value.length > 0) {
    const firstPoint = trackingPoints.value[0];
    if (firstPoint && firstPoint.lat != null && firstPoint.lng != null) {
      center = [firstPoint.lat, firstPoint.lng];
      zoom = 15;
    }
  }
  
  // Create map
  map = L.map(mapContainer.value, {
    zoomControl: true
  }).setView(center, zoom);
  
  // Add tile layer
  const tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
    maxZoom: 19
  }).addTo(map);
  
  // Wait for tiles to load before invalidating size and fitting bounds
  map.whenReady(() => {
    // Invalidate size to ensure map renders correctly
    setTimeout(() => {
      map.invalidateSize();
      
      // Add event location marker if available
      if (props.event.geoLocation?.latitude) {
        const eventMarker = L.marker([props.event.geoLocation.latitude, props.event.geoLocation.longitude])
          .addTo(map)
          .bindPopup('Event Location');
        
        // Add radius circle
        if (props.event.geoLocation.radius) {
          L.circle([props.event.geoLocation.latitude, props.event.geoLocation.longitude], {
            radius: props.event.geoLocation.radius,
            color: '#3b82f6',
            fillColor: '#3b82f6',
            fillOpacity: 0.1
          }).addTo(map);
        }
      }
      
      // Add tracking points (this will also fit bounds)
      updateTrackingPoints();
      
      // Invalidate size again after everything is loaded
      setTimeout(() => {
        map.invalidateSize();
      }, 100);
    }, 100);
  });
  
  mapLoaded.value = true;
};

const updateTrackingPoints = () => {
  if (!map || !window.L) return;
  
  const L = window.L;
  
  // Clear existing markers
  markers.forEach(marker => map.removeLayer(marker));
  markers = [];
  
  if (polyline) {
    map.removeLayer(polyline);
  }
  
  // Collect all tracking points
  const points = [];
  
  // Check-in point
  if (props.event.checkIn?.location && props.event.checkIn.location.latitude != null && props.event.checkIn.location.longitude != null) {
    const checkInPoint = {
      lat: props.event.checkIn.location.latitude,
      lng: props.event.checkIn.location.longitude,
      type: 'checkin',
      timestamp: props.event.checkIn.timestamp
    };
    points.push(checkInPoint);
    
    const marker = L.marker([checkInPoint.lat, checkInPoint.lng], {
      icon: L.divIcon({
        className: 'custom-marker checkin-marker',
        html: '<div class="w-4 h-4 bg-green-500 rounded-full border-2 border-white shadow-lg"></div>',
        iconSize: [16, 16],
        iconAnchor: [8, 8]
      })
    }).addTo(map).bindPopup('Check-In: ' + formatUserDateTime(checkInPoint.timestamp));
    markers.push(marker);
  }
  
  // Check-out point
  if (props.event.checkOut?.location && props.event.checkOut.location.latitude != null && props.event.checkOut.location.longitude != null) {
    const checkOutPoint = {
      lat: props.event.checkOut.location.latitude,
      lng: props.event.checkOut.location.longitude,
      type: 'checkout',
      timestamp: props.event.checkOut.timestamp
    };
    points.push(checkOutPoint);
    
    const marker = L.marker([checkOutPoint.lat, checkOutPoint.lng], {
      icon: L.divIcon({
        className: 'custom-marker checkout-marker',
        html: '<div class="w-4 h-4 bg-red-500 rounded-full border-2 border-white shadow-lg"></div>',
        iconSize: [16, 16],
        iconAnchor: [8, 8]
      })
    }).addTo(map).bindPopup('Check-Out: ' + formatUserDateTime(checkOutPoint.timestamp));
    markers.push(marker);
  }
  
  // Current location
  if (props.currentLocation && props.currentLocation.latitude != null && props.currentLocation.longitude != null) {
    const currentPoint = {
      lat: props.currentLocation.latitude,
      lng: props.currentLocation.longitude,
      type: 'current'
    };
    points.push(currentPoint);
    
    const marker = L.marker([currentPoint.lat, currentPoint.lng], {
      icon: L.divIcon({
        className: 'custom-marker current-marker',
        html: '<div class="w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-lg animate-pulse"></div>',
        iconSize: [16, 16],
        iconAnchor: [8, 8]
      })
    }).addTo(map).bindPopup('Current Location');
    markers.push(marker);
  }
  
  // Draw polyline if we have multiple points
  if (points.length > 1) {
    const latlngs = points
      .filter(p => p && p.lat != null && p.lng != null)
      .map(p => [p.lat, p.lng]);
    if (latlngs.length > 1) {
      polyline = L.polyline(latlngs, {
        color: '#3b82f6',
        weight: 3,
        opacity: 0.7
      }).addTo(map);
    }
  }
  
  trackingPoints.value = points;
  
  // Fit bounds if we have points
  if (points.length > 0 && markers.length > 0) {
    try {
      const group = new L.featureGroup(markers);
      const bounds = group.getBounds();
      if (bounds.isValid()) {
        map.fitBounds(bounds.pad(0.2), {
          padding: [20, 20],
          maxZoom: 18
        });
        // Invalidate size after fitting bounds to ensure proper rendering
        setTimeout(() => {
          map.invalidateSize();
        }, 100);
      }
    } catch (error) {
      console.warn('Error fitting map bounds:', error);
      // Fallback: center on first point
      if (points[0] && points[0].lat != null && points[0].lng != null) {
        map.setView([points[0].lat, points[0].lng], 15);
        map.invalidateSize();
      }
    }
  } else if (points.length === 1 && points[0] && points[0].lat != null && points[0].lng != null) {
    // Single point: center on it with appropriate zoom
    map.setView([points[0].lat, points[0].lng], 15);
    map.invalidateSize();
  }
};

const centerMap = () => {
  if (!map) return;
  
  if (trackingPoints.value.length > 0 && markers.length > 0) {
    try {
      const group = new window.L.featureGroup(markers);
      const bounds = group.getBounds();
      if (bounds.isValid()) {
        map.fitBounds(bounds.pad(0.2), {
          padding: [20, 20],
          maxZoom: 18
        });
        map.invalidateSize();
      }
    } catch (error) {
      console.warn('Error centering map:', error);
      // Fallback: center on first point
      if (trackingPoints.value[0] && trackingPoints.value[0].lat != null && trackingPoints.value[0].lng != null) {
        map.setView([trackingPoints.value[0].lat, trackingPoints.value[0].lng], 15);
        map.invalidateSize();
      }
    }
  } else if (props.event.geoLocation?.latitude != null && props.event.geoLocation?.longitude != null) {
    map.setView([props.event.geoLocation.latitude, props.event.geoLocation.longitude], 15);
    map.invalidateSize();
  } else if (props.event.checkIn?.location && props.event.checkIn.location.latitude != null && props.event.checkIn.location.longitude != null) {
    map.setView([props.event.checkIn.location.latitude, props.event.checkIn.location.longitude], 15);
    map.invalidateSize();
  }
};

watch(() => props.currentLocation, () => {
  if (mapLoaded.value && map) {
    updateTrackingPoints();
    // Invalidate size after updating to ensure proper rendering
    setTimeout(() => {
      if (map) map.invalidateSize();
    }, 100);
  }
}, { deep: true });

watch(() => props.event, () => {
  if (mapLoaded.value && map) {
    updateTrackingPoints();
    // Invalidate size after updating to ensure proper rendering
    setTimeout(() => {
      if (map) map.invalidateSize();
    }, 100);
  }
}, { deep: true });

onMounted(async () => {
  // Wait for next tick to ensure DOM is fully rendered
  await nextTick();
  
  // Small delay to ensure container has dimensions
  setTimeout(() => {
    initMap();
  }, 100);
});

onUnmounted(() => {
  if (map) {
    map.remove();
    map = null;
  }
});
</script>

<style scoped>
.custom-marker {
  background: transparent;
  border: none;
}
</style>

