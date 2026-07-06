import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

const CACHE_KEY = 'overpass_cache_serris';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

// Lit le cache s'il existe et n'a pas dépassé le TTL de 24h
async function getCached() {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { timestamp, elements } = JSON.parse(raw);
    if (Date.now() - timestamp > CACHE_TTL_MS) return null;
    return elements;
  } catch {
    return null;
  }
}

// Cache sans limite d'age, utilise seulement en secours hors-ligne.
async function getCachedIgnoringTTL() {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw).elements ?? null;
  } catch {
    return null;
  }
}

// Enregistre le résultat Overpass dans le cache avec l'horodatage actuel
async function setCached(elements) {
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ timestamp: Date.now(), elements }));
  } catch {}
}

// Miroirs Overpass essayés dans l'ordre en cas d'échec
const OVERPASS_API_URLS = [
  'https://z.overpass-api.de/api/interpreter',
  'https://lz4.overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

const OVERPASS_HEADERS = {
  'Content-Type': 'application/x-www-form-urlencoded',
  'User-Agent': 'CityMap/1.0 (local Expo React Native student project)',
};

// Construit la requête Overpass QL listant les lieux d'intérêt autour de Serris
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

// Transforme une erreur axios/Overpass en message lisible
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

// Envoie la requête au premier miroir Overpass disponible
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
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(radius)) {
    throw new Error('Coordonnees ou rayon invalides.');
  }

  const cached = await getCached();
  if (cached) return cached;

  const netState = await NetInfo.fetch();
  if (!netState.isConnected) {
    const stale = await getCachedIgnoringTTL();
    if (stale) return stale;
    throw new Error('Hors ligne et aucune donnee en cache.');
  }

  try {
    const response = await postOverpassQuery(buildSerrisPlacesQuery());
    const elements = response.data?.elements ?? [];
    await setCached(elements);
    return elements;
  } catch (error) {
    const message = getOverpassErrorMessage(error);
    console.error('fetchPlacesAround:', message);
    throw new Error(message);
  }
};
