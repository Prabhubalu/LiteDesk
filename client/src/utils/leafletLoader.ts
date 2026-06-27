declare global {
  interface Window {
    L?: {
      map: (element: HTMLElement, options?: Record<string, unknown>) => {
        setView: (center: [number, number], zoom: number) => void;
        getZoom: () => number;
        invalidateSize: () => void;
        removeLayer: (layer: unknown) => void;
        remove: () => void;
      };
      tileLayer: (url: string, options: Record<string, unknown>) => { addTo: (map: unknown) => unknown };
      marker: (center: [number, number], options?: Record<string, unknown>) => {
        addTo: (map: unknown) => {
          getLatLng: () => { lat: number; lng: number };
          on: (event: string, handler: () => void) => void;
        };
        on: (event: string, handler: () => void) => void;
        getLatLng: () => { lat: number; lng: number };
      };
      circle: (center: [number, number], options: Record<string, unknown>) => { addTo: (map: unknown) => unknown };
    };
  }
}

let leafletPromise: Promise<void> | null = null;

export function loadLeaflet(): Promise<void> {
  if (window.L && document.querySelector('link[href*="leaflet"]')) {
    return Promise.resolve();
  }

  if (!leafletPromise) {
    leafletPromise = new Promise((resolve, reject) => {
      if (!document.querySelector('link[href*="leaflet"]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
      }

      if (window.L) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load map library'));
      document.head.appendChild(script);
    });
  }

  return leafletPromise;
}
