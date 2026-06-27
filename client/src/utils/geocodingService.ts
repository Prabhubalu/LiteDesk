import apiClient from '@/utils/apiClient';
import type { GeocodeSuggestion } from '@/types/eventLocation.types';

interface GeocodeSearchResponse {
  success?: boolean;
  data?: GeocodeSuggestion[];
}

interface GeocodeReverseResponse {
  success?: boolean;
  data?: GeocodeSuggestion;
}

export async function searchLocations(query: string, limit = 5): Promise<GeocodeSuggestion[]> {
  const trimmed = query.trim();
  if (trimmed.length < 3) return [];

  const response = (await apiClient.get(
    `/geocode/search?q=${encodeURIComponent(trimmed)}&limit=${limit}`
  )) as GeocodeSearchResponse;

  return Array.isArray(response?.data) ? response.data : [];
}

export async function reverseGeocode(
  latitude: number,
  longitude: number
): Promise<GeocodeSuggestion | null> {
  const response = (await apiClient.get(
    `/geocode/reverse?lat=${encodeURIComponent(String(latitude))}&lon=${encodeURIComponent(String(longitude))}`
  )) as GeocodeReverseResponse;

  return response?.data ?? null;
}
