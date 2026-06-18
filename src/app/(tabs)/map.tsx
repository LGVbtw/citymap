import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import {
  connecterUtilisateur,
  initializeDatabase,
  inscriptionUtilisateur,
} from '../../../database';
import { fetchPlacesAround } from '../../../overpass';
import {
  addPlace as addPlaceToList,
  createList,
  getCurrentUser,
  getUserLists,
} from '../../store';

const C = {
  bg: '#0C0C14',
  card: '#13131E',
  border: 'rgba(255,255,255,0.07)',
  primary: '#4F8EF7',
  accent: '#22D3A8',
  text: '#FFFFFF',
  textMuted: '#6B7489',
  muted: 'rgba(255,255,255,0.05)',
  destructive: '#F75F5F',
};

const DEFAULT_COORDS = { latitude: 48.852, longitude: 2.782 };
const DEFAULT_REGION = { ...DEFAULT_COORDS, latitudeDelta: 0.04, longitudeDelta: 0.04 };
const DEMO_USER = { login: 'demo@citymap.local', username: 'Demo CityMap', mdp: 'demo' };

// Couleur par type de lieu
const TYPE_COLOR: Record<string, string> = {
  restaurant: '#f7a84f',
  cafe: '#c47bf7',
  bar: '#f75f5f',
  museum: '#4f8ef7',
  park: '#22d3a8',
  hotel: '#70d4f7',
  tourism: '#4f8ef7',
  historic: '#f7a84f',
  leisure: '#22d3a8',
  shop: '#c47bf7',
};

function typeColor(type: string) {
  return TYPE_COLOR[type.toLowerCase()] ?? C.primary;
}

// Reprise des helpers de App.js
function getPlaceType(place: any) {
  return (
    place.tags?.amenity ||
    place.tags?.tourism ||
    place.tags?.historic ||
    place.tags?.leisure ||
    place.tags?.shop ||
    'lieu'
  );
}

function getGeometryCenter(geometry: any[] = []) {
  const pts = geometry.filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lon));
  if (!pts.length) return null;
  const lats = pts.map((p: any) => p.lat);
  const lons = pts.map((p: any) => p.lon);
  return {
    latitude: (Math.min(...lats) + Math.max(...lats)) / 2,
    longitude: (Math.min(...lons) + Math.max(...lons)) / 2,
  };
}

function getPlaceCoordinate(place: any) {
  if (Number.isFinite(place.lat) && Number.isFinite(place.lon))
    return { latitude: place.lat, longitude: place.lon };
  if (Number.isFinite(place.center?.lat) && Number.isFinite(place.center?.lon))
    return { latitude: place.center.lat, longitude: place.center.lon };
  return getGeometryCenter(place.geometry);
}

function normalizePlace(place: any) {
  const coordinate = getPlaceCoordinate(place);
  if (!coordinate) return null;
  return {
    ...place,
    coordinate,
    displayName: place.tags?.name || 'Lieu sans nom',
    displayType: getPlaceType(place),
    osmId: String(place.id),
    osmType: place.type || 'node',
  };
}

// Dark map style (Android)
const DARK_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#1a1a2e' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1a1a2e' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8b9bc0' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2d2d44' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#1a1a2e' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0e1628' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#1e1e30' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#2d2d44' }] },
];

export default function MapScreen() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [dbReady, setDbReady] = useState(false);
  const [places, setPlaces] = useState<any[]>([]);
  const [loadingPlaces, setLoadingPlaces] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [selectedPlace, setSelectedPlace] = useState<any | null>(null);

  const isBooting = !dbReady || loadingPlaces;

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await initializeDatabase();
        let user = await connecterUtilisateur(DEMO_USER.login, DEMO_USER.mdp);
        if (!user) {
          await inscriptionUtilisateur(DEMO_USER.login, DEMO_USER.username, DEMO_USER.mdp);
          user = await connecterUtilisateur(DEMO_USER.login, DEMO_USER.mdp);
        }
        if (mounted) { setCurrentUser(user); setDbReady(true); }
      } catch {
        if (mounted) setDbReady(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const elements = await fetchPlacesAround(DEFAULT_COORDS.latitude, DEFAULT_COORDS.longitude);
        if (mounted) setPlaces(elements.map(normalizePlace).filter(Boolean));
      } catch {
        if (mounted) Alert.alert('Erreur', 'Impossible de récupérer les lieux.');
      } finally {
        if (mounted) setLoadingPlaces(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  async function handleSave(place: any) {
    const key = `${place.osmType}-${place.osmId}`;
    try {
      setSavingKey(key);

      const user = await getCurrentUser();
      if (!user) {
        Alert.alert('Non connecté', 'Connectez-vous pour sauvegarder des lieux.');
        return;
      }

      // Trouver ou créer la liste "Favoris"
      const lists = await getUserLists(user.id);
      let favList = lists.find(l => l.title === 'Favoris');
      if (!favList) {
        favList = await createList(user.id, 'Favoris', 'Mes lieux favoris de la carte', '⭐', '#f7a84f');
      }

      // Éviter les doublons
      if (favList.places.some(p => p.name === place.displayName)) {
        Alert.alert('Déjà sauvegardé', `${place.displayName} est déjà dans vos Favoris.`);
        return;
      }

      await addPlaceToList(favList.id, {
        name: place.displayName,
        type: place.displayType,
        notes: '',
        price: 1,
        googleMapsLink: `https://maps.google.com/?q=${place.coordinate.latitude},${place.coordinate.longitude}`,
        latitude: place.coordinate.latitude,
        longitude: place.coordinate.longitude,
      });

      Alert.alert('Ajouté aux Favoris ⭐', `${place.displayName} a été ajouté à votre liste Favoris.`);
    } catch {
      Alert.alert('Erreur', 'Impossible de sauvegarder ce lieu.');
    } finally {
      setSavingKey(null);
    }
  }

  // Filtres par type unique
  const types = useMemo(() => {
    const set = new Set(places.map(p => p.displayType));
    return Array.from(set).slice(0, 8);
  }, [places]);

  const displayed = activeFilter
    ? places.filter(p => p.displayType === activeFilter)
    : places;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Carte</Text>
          <Text style={styles.subtitle}>Serris, Île-de-France</Text>
        </View>
        <View style={styles.badge}>
          {isBooting ? (
            <ActivityIndicator size="small" color={C.primary} />
          ) : (
            <>
              <Ionicons name="location" size={13} color={C.accent} />
              <Text style={styles.badgeText}>{places.length} lieux</Text>
            </>
          )}
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Map card */}
        <View style={styles.mapCard}>
          <MapView
            style={styles.map}
            initialRegion={DEFAULT_REGION}
            userInterfaceStyle="dark"
            customMapStyle={DARK_MAP_STYLE}
          >
            {places.map(place => {
              const key = `${place.osmType}-${place.osmId}`;
              const color = typeColor(place.displayType);
              return (
                <Marker
                  key={key}
                  coordinate={place.coordinate}
                  pinColor={color}
                  onPress={() => setSelectedPlace(place)}
                />
              );
            })}
          </MapView>
        </View>

        {/* Filter chips */}
        {types.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filters}
          >
            <TouchableOpacity
              onPress={() => setActiveFilter(null)}
              style={[styles.chip, !activeFilter && { backgroundColor: C.primary }]}
            >
              <Text style={[styles.chipText, !activeFilter && { color: 'white' }]}>Tous</Text>
            </TouchableOpacity>
            {types.map(t => {
              const color = typeColor(t);
              const active = activeFilter === t;
              return (
                <TouchableOpacity
                  key={t}
                  onPress={() => setActiveFilter(active ? null : t)}
                  style={[
                    styles.chip,
                    active && { backgroundColor: `${color}25`, borderColor: `${color}60` },
                  ]}
                >
                  <Text style={[styles.chipText, active && { color }]}>{t}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {/* Places list */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {isBooting ? 'Chargement…' : `${displayed.length} lieu${displayed.length > 1 ? 'x' : ''} à proximité`}
          </Text>

          {isBooting ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator color={C.primary} />
              <Text style={styles.loadingText}>Récupération des lieux…</Text>
            </View>
          ) : (
            displayed.map(place => {
              const key = `${place.osmType}-${place.osmId}`;
              const color = typeColor(place.displayType);
              const saving = savingKey === key;
              return (
                <View key={key} style={styles.placeRow}>
                  <View style={[styles.placeIconWrap, { backgroundColor: `${color}18` }]}>
                    <Ionicons name="location" size={18} color={color} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.placeName} numberOfLines={1}>
                      {place.displayName}
                    </Text>
                    <View style={[styles.placeTypeBadge, { backgroundColor: `${color}18` }]}>
                      <Text style={[styles.placeTypeText, { color }]}>{place.displayType}</Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    onPress={() => handleSave(place)}
                    disabled={saving}
                    style={[styles.saveBtn, saving && { opacity: 0.5 }]}
                  >
                    {saving ? (
                      <ActivityIndicator size="small" color="white" />
                    ) : (
                      <Ionicons name="bookmark-outline" size={16} color="white" />
                    )}
                  </TouchableOpacity>
                </View>
              );
            })
          )}
        </View>
        <View style={{ height: 24 }} />
      </ScrollView>

      {/* Place detail bottom sheet */}
      <Modal
        visible={!!selectedPlace}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedPlace(null)}
      >
        <Pressable style={styles.overlay} onPress={() => setSelectedPlace(null)}>
          <Pressable style={styles.sheet} onPress={e => e.stopPropagation()}>
            {selectedPlace && (() => {
              const color = typeColor(selectedPlace.displayType);
              const key = `${selectedPlace.osmType}-${selectedPlace.osmId}`;
              const saving = savingKey === key;
              return (
                <>
                  <View style={styles.sheetHandle} />
                  <View style={styles.sheetHeader}>
                    <View style={[styles.sheetIconWrap, { backgroundColor: `${color}20` }]}>
                      <Ionicons name="location" size={22} color={color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.sheetName}>{selectedPlace.displayName}</Text>
                      <View style={[styles.sheetTypeBadge, { backgroundColor: `${color}18` }]}>
                        <Text style={[styles.sheetTypeText, { color }]}>
                          {selectedPlace.displayType}
                        </Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      onPress={() => setSelectedPlace(null)}
                      style={styles.sheetClose}
                    >
                      <Ionicons name="close" size={20} color={C.textMuted} />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.sheetCoords}>
                    <Ionicons name="navigate-outline" size={13} color={C.textMuted} />
                    <Text style={styles.sheetCoordsText}>
                      {selectedPlace.coordinate.latitude.toFixed(5)}, {selectedPlace.coordinate.longitude.toFixed(5)}
                    </Text>
                  </View>

                  <TouchableOpacity
                    onPress={async () => {
                      await handleSave(selectedPlace);
                      setSelectedPlace(null);
                    }}
                    disabled={saving}
                    style={[styles.sheetSaveBtn, { backgroundColor: color }, saving && { opacity: 0.5 }]}
                  >
                    {saving ? (
                      <ActivityIndicator color="white" />
                    ) : (
                      <>
                        <Ionicons name="bookmark" size={16} color="white" />
                        <Text style={styles.sheetSaveText}>Sauvegarder ce lieu</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </>
              );
            })()}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 14,
  },
  title: { fontSize: 26, fontWeight: '700', color: C.text, letterSpacing: -0.4 },
  subtitle: { fontSize: 12, color: C.textMuted, marginTop: 2 },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 12,
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
    minWidth: 80, justifyContent: 'center',
  },
  badgeText: { fontSize: 13, fontWeight: '600', color: C.text },
  mapCard: {
    marginHorizontal: 16, marginBottom: 14,
    borderRadius: 20, overflow: 'hidden',
    borderWidth: 1, borderColor: C.border,
    height: 260,
  },
  map: { flex: 1 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: C.card, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, paddingBottom: 36, borderWidth: 1, borderColor: C.border,
  },
  sheetHandle: {
    width: 36, height: 4, borderRadius: 2, backgroundColor: C.border,
    alignSelf: 'center', marginBottom: 20,
  },
  sheetHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 14 },
  sheetIconWrap: {
    width: 48, height: 48, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  sheetName: { fontSize: 17, fontWeight: '700', color: C.text, marginBottom: 6, lineHeight: 22 },
  sheetTypeBadge: {
    alignSelf: 'flex-start', borderRadius: 6,
    paddingHorizontal: 9, paddingVertical: 3,
  },
  sheetTypeText: { fontSize: 12, fontWeight: '600', textTransform: 'capitalize' },
  sheetClose: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: C.muted, alignItems: 'center', justifyContent: 'center',
  },
  sheetCoords: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: C.muted, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 9, marginBottom: 16,
  },
  sheetCoordsText: { fontSize: 12, color: C.textMuted, fontFamily: 'monospace' },
  sheetSaveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 15, borderRadius: 14,
  },
  sheetSaveText: { color: 'white', fontWeight: '700', fontSize: 16 },
  filters: { paddingHorizontal: 16, gap: 8, paddingBottom: 14 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
  },
  chipText: { fontSize: 12, fontWeight: '600', color: C.textMuted, textTransform: 'capitalize' },
  section: { paddingHorizontal: 16 },
  sectionTitle: { fontSize: 15, fontWeight: '600', color: C.text, marginBottom: 12 },
  loadingBox: { alignItems: 'center', paddingVertical: 32, gap: 12 },
  loadingText: { color: C.textMuted, fontSize: 13 },
  placeRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: C.card, borderRadius: 14, padding: 12,
    borderWidth: 1, borderColor: C.border, marginBottom: 10,
  },
  placeIconWrap: {
    width: 40, height: 40, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  placeName: { fontSize: 14, fontWeight: '600', color: C.text, marginBottom: 4 },
  placeTypeBadge: {
    alignSelf: 'flex-start', borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  placeTypeText: { fontSize: 11, fontWeight: '600', textTransform: 'capitalize' },
  saveBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: C.primary,
    alignItems: 'center', justifyContent: 'center',
  },
});
