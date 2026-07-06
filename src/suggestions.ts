import { fetchPlacesAround } from '../overpass';
import { getUserLists, Place } from './store';

export type Suggestion = {
  name: string;
  type: string;
  reason: string;
  rating: number;
  price: number;
  address: string;
  lat: number;
  lng: number;
};

// Coordonnées de secours si l'utilisateur n'a encore aucun lieu sauvegardé
const DEFAULT_COORDS = { lat: 48.852, lon: 2.782 };

// Déduit le type d'un élément Overpass à partir de ses tags
function placeType(tags: Record<string, string> = {}): string {
  return tags.amenity || tags.tourism || tags.historic || tags.leisure || tags.shop || 'lieu';
}

// Extrait les coordonnées d'un élément Overpass (point ou centre d'une zone)
function placeCoords(el: any): { lat: number; lon: number } | null {
  if (Number.isFinite(el.lat) && Number.isFinite(el.lon)) return { lat: el.lat, lon: el.lon };
  if (Number.isFinite(el.center?.lat) && Number.isFinite(el.center?.lon)) {
    return { lat: el.center.lat, lon: el.center.lon };
  }
  return null;
}

// Distance à vol d'oiseau entre deux coordonnées (formule de Haversine)
function distanceKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Recommande des lieux proches de ceux deja sauvegardes par l'utilisateur (toutes listes confondues),
 * en priorisant les types les plus frequents.
 */
export async function getSuggestions(userId: string, limit = 5): Promise<Suggestion[]> {
  const lists = await getUserLists(userId);
  return getSuggestionsForPlaces(lists.flatMap(l => l.places), limit);
}

/**
 * Recommande des lieux proches d'un ensemble de lieux donne (ex: une seule liste),
 * en priorisant les types les plus frequents dans cet ensemble.
 */
export async function getSuggestionsForPlaces(saved: Place[], limit = 5): Promise<Suggestion[]> {
  if (saved.length === 0) return [];

  const savedNames = new Set(saved.map(p => p.name.toLowerCase()));
  const typeCounts = new Map<string, number>();
  saved.forEach(p => {
    const t = p.type?.toLowerCase();
    if (t) typeCounts.set(t, (typeCounts.get(t) ?? 0) + 1);
  });
  const ratedPlaces = saved.filter(p => Number.isFinite(p.rating));
  const avgRating = ratedPlaces.length
    ? ratedPlaces.reduce((sum, p) => sum + (p.rating ?? 0), 0) / ratedPlaces.length
    : 4;
  const centroid = {
    lat: saved.reduce((sum, p) => sum + p.latitude, 0) / saved.length,
    lon: saved.reduce((sum, p) => sum + p.longitude, 0) / saved.length,
  };

  let elements: any[];
  try {
    elements = await fetchPlacesAround(centroid.lat || DEFAULT_COORDS.lat, centroid.lon || DEFAULT_COORDS.lon);
  } catch {
    return [];
  }

  return elements
    .map(el => {
      const coords = placeCoords(el);
      const name = el.tags?.name;
      if (!coords || !name || savedNames.has(name.toLowerCase())) return null;

      const type = placeType(el.tags);
      const typeScore = typeCounts.get(type.toLowerCase()) ?? 0;
      const proximityScore = Math.max(0, 5 - distanceKm(centroid, coords));
      const score = typeScore * 3 + proximityScore;
      if (score <= 0) return null;

      return {
        score,
        suggestion: {
          name,
          type,
          reason: typeScore > 0
            ? `Correspond à vos lieux de type ${type}`
            : 'Proche de vos lieux sauvegardés',
          rating: Math.round(avgRating * 10) / 10,
          price: 2,
          address: '',
          lat: coords.lat,
          lng: coords.lon,
        },
      };
    })
    .filter((x): x is { score: number; suggestion: Suggestion } => x !== null)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(x => x.suggestion);
}
