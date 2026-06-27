export interface EventGeoLocation {
  latitude: number | null;
  longitude: number | null;
  address?: string | null;
  radius?: number;
  accuracy?: number | null;
}

export interface GeocodeSuggestion {
  label: string;
  latitude: number;
  longitude: number;
}

export const DEFAULT_GEO_RADIUS_METERS = 100;

export function createEmptyGeoLocation(radius = DEFAULT_GEO_RADIUS_METERS): EventGeoLocation {
  return {
    latitude: null,
    longitude: null,
    address: null,
    radius,
    accuracy: null,
  };
}

export function hasGeoCoordinates(geo: EventGeoLocation | null | undefined): boolean {
  return (
    geo != null
    && geo.latitude != null
    && geo.longitude != null
    && Number.isFinite(geo.latitude)
    && Number.isFinite(geo.longitude)
  );
}
