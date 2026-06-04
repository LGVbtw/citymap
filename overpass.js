import axios from 'axios';

const OVERPASS_API_URLS = [
  'https://z.overpass-api.de/api/interpreter',
  'https://lz4.overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

const OVERPASS_HEADERS = {
  'Content-Type': 'application/x-www-form-urlencoded',
  'User-Agent': 'CityMap/1.0 (local Expo React Native student project)',
};

const buildSerrisPlacesQuery = () => `
[out:json][timeout:25];
// Equivalent API du macro Overpass Turbo {{geocodeArea:Serris}}.
area["name"="Serris"]["boundary"="administrative"]["admin_level"="8"]->.searchArea;
(
  nwr["amenity"="restaurant"](area.searchArea);
  nwr["amenity"="cafe"](area.searchArea);
  nwr["amenity"="bar"](area.searchArea);
  nwr["amenity"="pub"](area.searchArea);
  nwr["amenity"="fast_food"](area.searchArea);
  nwr["amenity"="ice_cream"](area.searchArea);
  nwr["tourism"="museum"](area.searchArea);
  nwr["amenity"="cinema"](area.searchArea);
  nwr["amenity"="theatre"](area.searchArea);
  nwr["tourism"="gallery"](area.searchArea);
  nwr["historic"="monument"](area.searchArea);
  nwr["amenity"="nightclub"](area.searchArea);
  nwr["leisure"="park"](area.searchArea);
  nwr["leisure"="amusement_arcade"](area.searchArea);
  nwr["leisure"="bowling_alley"](area.searchArea);
  nwr["leisure"="theme_park"](area.searchArea);
  nwr["shop"="mall"](area.searchArea);
  nwr["amenity"="marketplace"](area.searchArea);
);
out geom;
`;

const getOverpassErrorMessage = (error) => {
  const apiError =
    typeof error.response?.data === 'string'
      ? error.response.data.replace(/\s+/g, ' ').slice(0, 240)
      : error.response?.data?.remark;

  return error.response
    ? `Overpass API ${error.response.status}: ${
        apiError || error.response.statusText || 'requete refusee'
      }`
    : error.message || 'Erreur inconnue pendant la recuperation des lieux.';
};

const postOverpassQuery = async (query) => {
  let lastError = null;
  const body = `data=${encodeURIComponent(query)}`;

  for (const url of OVERPASS_API_URLS) {
    try {
      return await axios.post(url, body, {
        headers: OVERPASS_HEADERS,
        timeout: 30000,
      });
    } catch (error) {
      lastError = error;
      console.warn(`Overpass endpoint failed (${url}):`, getOverpassErrorMessage(error));
    }
  }

  throw lastError;
};

/**
 * Recupere les lieux de Serris avec une requete Overpass QL compatible API.
 * Les parametres sont gardes pour conserver la signature demandee.
 */
export const fetchPlacesAround = async (lat, lon, radius = 1000) => {
  try {
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(radius)) {
      throw new Error('Coordonnees ou rayon invalides.');
    }

    const response = await postOverpassQuery(buildSerrisPlacesQuery());

    return response.data?.elements ?? [];
  } catch (error) {
    const message = getOverpassErrorMessage(error);

    console.error('fetchPlacesAround:', message);
    throw new Error(message);
  }
};
