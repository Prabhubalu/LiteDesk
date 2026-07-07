/**
 * Geocoding proxy (OpenStreetMap Nominatim).
 * Keeps third-party calls server-side and applies usage-policy headers.
 */

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';
const USER_AGENT = 'Arivu/1.0 (event-location; contact@arivu.com)';

async function nominatimFetch(path) {
  const response = await fetch(`${NOMINATIM_BASE}${path}`, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    const err = new Error(`Geocoding provider error (${response.status})`);
    err.statusCode = response.status === 429 ? 429 : 502;
    throw err;
  }

  return response.json();
}

function mapSearchResult(row) {
  const latitude = Number.parseFloat(row.lat);
  const longitude = Number.parseFloat(row.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  return {
    label: row.display_name,
    latitude,
    longitude,
  };
}

exports.search = async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    if (q.length < 3) {
      return res.json({ success: true, data: [] });
    }

    const limit = Math.min(Number.parseInt(req.query.limit, 10) || 5, 8);
    const params = new URLSearchParams({
      format: 'json',
      q,
      limit: String(limit),
      addressdetails: '0',
    });

    const rows = await nominatimFetch(`/search?${params.toString()}`);
    const data = Array.isArray(rows)
      ? rows.map(mapSearchResult).filter(Boolean)
      : [];

    return res.json({ success: true, data });
  } catch (error) {
    const status = error.statusCode || 500;
    return res.status(status).json({
      success: false,
      message: status === 429
        ? 'Location search is temporarily unavailable. Try again shortly.'
        : 'Unable to search locations right now.',
    });
  }
};

exports.reverse = async (req, res) => {
  try {
    const latitude = Number.parseFloat(req.query.lat);
    const longitude = Number.parseFloat(req.query.lon);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return res.status(400).json({
        success: false,
        message: 'lat and lon query parameters are required.',
      });
    }

    const params = new URLSearchParams({
      format: 'json',
      lat: String(latitude),
      lon: String(longitude),
      zoom: '18',
      addressdetails: '0',
    });

    const row = await nominatimFetch(`/reverse?${params.toString()}`);
    const latitudeOut = Number.parseFloat(row?.lat);
    const longitudeOut = Number.parseFloat(row?.lon);

    if (!Number.isFinite(latitudeOut) || !Number.isFinite(longitudeOut)) {
      return res.status(404).json({
        success: false,
        message: 'No address found for this location.',
      });
    }

    return res.json({
      success: true,
      data: {
        label: row.display_name || `${latitudeOut}, ${longitudeOut}`,
        latitude: latitudeOut,
        longitude: longitudeOut,
      },
    });
  } catch (error) {
    const status = error.statusCode || 500;
    return res.status(status).json({
      success: false,
      message: 'Unable to resolve this map pin to an address.',
    });
  }
};
