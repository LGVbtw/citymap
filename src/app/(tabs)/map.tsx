import { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import NetInfo from '@react-native-community/netinfo';
import { fetchPlacesAround } from '../../../overpass';
import { Skeleton } from '../../components/Skeleton';
import {
  addPlace as addPlaceToList,
  createList,
  getCurrentUser,
  getUserLists,
  type ListItem,
} from '../../store';
import { useAppTheme } from '../../context/ThemeContext';

const DEFAULT_COORDS = { latitude: 48.852, longitude: 2.782 };
const DEFAULT_REGION = { ...DEFAULT_COORDS, latitudeDelta: 0.04, longitudeDelta: 0.04 };

// Couleur associée à chaque type de lieu OSM
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

// Icône Ionicons associée à chaque type de lieu OSM
const TYPE_ICON: Record<string, string> = {
  restaurant: 'restaurant-outline',
  cafe: 'cafe-outline',
  bar: 'beer-outline',
  museum: 'business-outline',
  park: 'leaf-outline',
  hotel: 'bed-outline',
  tourism: 'compass-outline',
  historic: 'hourglass-outline',
  leisure: 'basketball-outline',
  shop: 'bag-handle-outline',
};

// Couleur d'un type de lieu, avec une couleur de secours si inconnu
function typeColor(type: string, fallback: string) {
  return TYPE_COLOR[type.toLowerCase()] ?? fallback;
}

// Icône d'un type de lieu, avec une icône de secours si inconnu
function typeIcon(type: string): any {
  return TYPE_ICON[type.toLowerCase()] ?? 'location-outline';
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

// Transforme un élément Overpass brut en lieu affichable sur la carte
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

// Écran d'accueil : carte + liste des lieux à proximité
export default function MapScreen() {
  const [places, setPlaces] = useState<any[]>([]);
  const [loadingPlaces, setLoadingPlaces] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [selectedPlace, setSelectedPlace] = useState<any | null>(null);
  const [pickerPlace, setPickerPlace] = useState<any | null>(null);
  const [pickerLists, setPickerLists] = useState<ListItem[]>([]);
  const [newListTitle, setNewListTitle] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const { isLightTheme, C } = useAppTheme();
  const styles = useMemo(() => getStyles(C), [C]);

  const scrollRef = useRef<ScrollView>(null);
  const mapRef = useRef<MapView>(null);

  // Sélectionne un lieu : scrolle en haut et centre la carte dessus
  const handlePlacePress = useCallback((place: any) => {
    scrollRef.current?.scrollTo({ y: 0, animated: true });
    setSelectedPlace(place);
    setTimeout(() => {
      mapRef.current?.animateToRegion({
        latitude: place.coordinate.latitude,
        longitude: place.coordinate.longitude,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      });
    }, 50);
  }, []);

  const isBooting = loadingPlaces;

  // Surveille la connexion réseau pour afficher le bandeau hors-ligne
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOffline(!state.isConnected);
    });
    return unsubscribe;
  }, []);

  // Charge les lieux Overpass autour de Serris au montage de l'écran
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

  // Ouvre la modale de choix de liste pour un lieu donné
  async function openListPicker(place: any) {
    try {
      const user = await getCurrentUser();
      if (!user) {
        Alert.alert('Non connecté', 'Connectez-vous pour sauvegarder des lieux.');
        return;
      }
      const lists = await getUserLists(user.id);
      setPickerLists(lists);
      setPickerPlace(place);
    } catch {
      Alert.alert('Erreur', 'Impossible de charger vos listes.');
    }
  }

  // Ajoute le lieu sélectionné dans la liste choisie par l'utilisateur
  async function handleAddToList(list: ListItem) {
    if (!pickerPlace) return;
    const key = `${pickerPlace.osmType}-${pickerPlace.osmId}`;
    try {
      setSavingKey(key);

      if (list.places.some(p => p.name === pickerPlace.displayName)) {
        Alert.alert('Déjà sauvegardé', `${pickerPlace.displayName} est déjà dans "${list.title}".`);
        return;
      }

      await addPlaceToList(list.id, {
        name: pickerPlace.displayName,
        type: pickerPlace.displayType,
        notes: '',
        price: 1,
        googleMapsLink: `https://maps.google.com/?q=${pickerPlace.coordinate.latitude},${pickerPlace.coordinate.longitude}`,
        latitude: pickerPlace.coordinate.latitude,
        longitude: pickerPlace.coordinate.longitude,
      });

      Alert.alert('Ajouté ✅', `${pickerPlace.displayName} a été ajouté à "${list.title}".`);
    } catch {
      Alert.alert('Erreur', 'Impossible de sauvegarder ce lieu.');
    } finally {
      setSavingKey(null);
      setPickerPlace(null);
      setSelectedPlace(null);
    }
  }

  // Crée une nouvelle liste à la volée puis y ajoute le lieu sélectionné
  async function handleCreateListAndAdd() {
    const title = newListTitle.trim();
    if (!title || !pickerPlace) return;
    try {
      const user = await getCurrentUser();
      if (!user) return;
      const list = await createList(user.id, title, '', '📍', C.primary);
      setNewListTitle('');
      await handleAddToList(list);
    } catch {
      Alert.alert('Erreur', 'Impossible de créer la liste.');
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

      {isOffline && (
        <View style={styles.offlineBanner}>
          <Ionicons name="cloud-offline-outline" size={14} color="#f7a84f" />
          <Text style={styles.offlineBannerText}>Hors ligne — données en cache</Text>
        </View>
      )}

      <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false}>
        {/* Map card */}
        <View style={styles.mapCard}>
          <MapView
            ref={mapRef}
            style={styles.map}
            initialRegion={DEFAULT_REGION}
            userInterfaceStyle={isLightTheme ? "light" : "dark"}
            customMapStyle={isLightTheme ? [] : DARK_MAP_STYLE}
          >
            {displayed.map(place => {
              const key = `${place.osmType}-${place.osmId}`;
              const color = typeColor(place.displayType, C.primary);
              return (
                <Marker
                  key={key}
                  coordinate={place.coordinate}
                  onPress={() => setSelectedPlace(place)}
                >
                  <View style={[styles.markerPin, { backgroundColor: color }]}>
                    <Ionicons name={typeIcon(place.displayType)} size={14} color="white" />
                  </View>
                </Marker>
              );
            })}
          </MapView>
          <TouchableOpacity
            style={styles.fullscreenBtn}
            onPress={() => setIsFullscreen(true)}
          >
            <Ionicons name="expand-outline" size={18} color="white" />
          </TouchableOpacity>
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
              <Ionicons
                name="apps-outline"
                size={11}
                color={!activeFilter ? 'white' : C.textMuted}
                style={{ marginRight: 4 }}
              />
              <Text style={[styles.chipText, !activeFilter && { color: 'white' }]}>Tous</Text>
            </TouchableOpacity>
            {types.map(t => {
              const color = typeColor(t, C.primary);
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
                  <Ionicons
                    name={typeIcon(t)}
                    size={11}
                    color={active ? color : C.textMuted}
                    style={{ marginRight: 4 }}
                  />
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
            [1, 2, 3].map(i => (
              <View key={i} style={styles.placeRow}>
                <Skeleton style={{ width: 40, height: 40, borderRadius: 10 }} />
                <View style={{ flex: 1, gap: 6 }}>
                  <Skeleton style={{ width: '60%', height: 14 }} />
                  <Skeleton style={{ width: '35%', height: 10 }} />
                </View>
              </View>
            ))
          ) : displayed.length === 0 ? (
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Ionicons name="location-outline" size={28} color={C.textMuted} />
              </View>
              <Text style={styles.emptyText}>Aucun lieu trouvé</Text>
              <Text style={styles.emptySubtext}>
                {activeFilter ? 'Essayez un autre filtre.' : 'Aucun lieu à proximité pour le moment.'}
              </Text>
            </View>
          ) : (
            displayed.map(place => {
              const key = `${place.osmType}-${place.osmId}`;
              const color = typeColor(place.displayType, C.primary);
              const saving = savingKey === key;
              return (
                <TouchableOpacity 
                  key={key} 
                  style={styles.placeRow}
                  activeOpacity={0.7}
                  onPress={() => handlePlacePress(place)}
                >
                  <View style={[styles.placeIconWrap, { backgroundColor: `${color}18` }]}>
                    <Ionicons name={typeIcon(place.displayType)} size={18} color={color} />
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
                    onPress={() => openListPicker(place)}
                    disabled={saving}
                    style={[styles.saveBtn, saving && { opacity: 0.5 }]}
                  >
                    {saving ? (
                      <ActivityIndicator size="small" color="white" />
                    ) : (
                      <Ionicons name="bookmark-outline" size={16} color="white" />
                    )}
                  </TouchableOpacity>
                </TouchableOpacity>
              );
            })
          )}
        </View>
        <View style={{ height: 24 }} />
      </ScrollView>

      {/* Fullscreen map */}
      <Modal
        visible={isFullscreen}
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setIsFullscreen(false)}
      >
        <View style={styles.fullscreenContainer}>
          <MapView
            style={StyleSheet.absoluteFillObject}
            initialRegion={DEFAULT_REGION}
            userInterfaceStyle={isLightTheme ? "light" : "dark"}
            customMapStyle={isLightTheme ? [] : DARK_MAP_STYLE}
          >
            {displayed.map(place => {
              const key = `${place.osmType}-${place.osmId}`;
              const color = typeColor(place.displayType, C.primary);
              return (
                <Marker
                  key={key}
                  coordinate={place.coordinate}
                  onPress={() => setSelectedPlace(place)}
                >
                  <View style={[styles.markerPin, { backgroundColor: color }]}>
                    <Ionicons name={typeIcon(place.displayType)} size={14} color="white" />
                  </View>
                </Marker>
              );
            })}
          </MapView>
          <TouchableOpacity
            style={styles.fullscreenCloseBtn}
            onPress={() => setIsFullscreen(false)}
          >
            <Ionicons name="contract-outline" size={18} color="white" />
          </TouchableOpacity>
        </View>
      </Modal>

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
              const color = typeColor(selectedPlace.displayType, C.primary);
              const key = `${selectedPlace.osmType}-${selectedPlace.osmId}`;
              const saving = savingKey === key;
              return (
                <>
                  <View style={styles.sheetHandle} />
                  <View style={styles.sheetHeader}>
                    <View style={[styles.sheetIconWrap, { backgroundColor: `${color}20` }]}>
                      <Ionicons name={typeIcon(selectedPlace.displayType)} size={22} color={color} />
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
                    onPress={() => openListPicker(selectedPlace)}
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

      {/* Choix de la liste */}
      <Modal
        visible={!!pickerPlace}
        transparent
        animationType="slide"
        onRequestClose={() => setPickerPlace(null)}
      >
        <Pressable style={styles.overlay} onPress={() => setPickerPlace(null)}>
          <Pressable style={styles.sheet} onPress={e => e.stopPropagation()}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetName, { flex: 1 }]}>Ajouter à une liste</Text>
              <TouchableOpacity onPress={() => setPickerPlace(null)} style={styles.sheetClose}>
                <Ionicons name="close" size={20} color={C.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 260 }}>
              {pickerLists.length === 0 ? (
                <Text style={styles.emptySubtext}>Vous n'avez pas encore de liste.</Text>
              ) : (
                pickerLists.map(list => (
                  <TouchableOpacity
                    key={list.id}
                    style={styles.listPickRow}
                    onPress={() => handleAddToList(list)}
                    disabled={savingKey !== null}
                  >
                    <Text style={{ fontSize: 20 }}>{list.emoji}</Text>
                    <Text style={styles.listPickTitle} numberOfLines={1}>{list.title}</Text>
                    {savingKey !== null ? (
                      <ActivityIndicator size="small" color={C.textMuted} />
                    ) : (
                      <Ionicons name="chevron-forward" size={16} color={C.textMuted} />
                    )}
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>

            <View style={styles.newListRow}>
              <TextInput
                style={styles.newListInput}
                placeholder="Nouvelle liste…"
                placeholderTextColor={C.textMuted}
                value={newListTitle}
                onChangeText={setNewListTitle}
              />
              <TouchableOpacity
                onPress={handleCreateListAndAdd}
                disabled={!newListTitle.trim()}
                style={[styles.newListBtn, { backgroundColor: C.primary }, !newListTitle.trim() && { opacity: 0.5 }]}
              >
                <Ionicons name="add" size={20} color="white" />
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const getStyles = (C: any) => StyleSheet.create({
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
  offlineBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginHorizontal: 16, marginBottom: 10, paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 10, backgroundColor: 'rgba(247,168,79,0.12)',
    borderWidth: 1, borderColor: 'rgba(247,168,79,0.3)',
  },
  offlineBannerText: { fontSize: 12, fontWeight: '600', color: '#f7a84f' },
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
  listPickRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, paddingHorizontal: 4,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  listPickTitle: { flex: 1, fontSize: 15, fontWeight: '600', color: C.text },
  newListRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16,
  },
  newListInput: {
    flex: 1, backgroundColor: C.muted, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: C.text,
  },
  newListBtn: {
    width: 44, height: 44, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  filters: { paddingHorizontal: 16, gap: 8, paddingBottom: 14 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
    flexDirection: 'row', alignItems: 'center',
  },
  chipText: { fontSize: 12, fontWeight: '600', color: C.textMuted, textTransform: 'capitalize' },
  section: { paddingHorizontal: 16 },
  sectionTitle: { fontSize: 15, fontWeight: '600', color: C.text, marginBottom: 12 },
  empty: { alignItems: 'center', paddingVertical: 48 },
  emptyIcon: {
    width: 64, height: 64, borderRadius: 16, backgroundColor: C.muted,
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  emptyText: { color: C.textMuted, fontSize: 14 },
  emptySubtext: { color: C.textMuted, fontSize: 12, marginTop: 4 },
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
  fullscreenContainer: {
    flex: 1, backgroundColor: C.bg,
  },
  fullscreenBtn: {
    position: 'absolute', top: 10, right: 10,
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
  },
  fullscreenCloseBtn: {
    position: 'absolute', top: 54, right: 16,
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },
  markerPin: {
    width: 30, height: 30, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5, shadowRadius: 3, elevation: 5,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.25)',
  },
});
