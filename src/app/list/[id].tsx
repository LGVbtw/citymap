import { useCallback, useEffect, useState, useMemo, useRef } from 'react';
import * as Clipboard from 'expo-clipboard';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
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
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker } from 'react-native-maps';
import {
  ListItem,
  Place,
  addNotification,
  addPlace,
  deleteList,
  deletePlace,
  getCurrentUser,
  getLists,
  updateList,
  updatePlace,
} from '../../store';
import { getSuggestionsForPlaces, Suggestion } from '../../suggestions';
import { useAppTheme } from '../../context/ThemeContext';

// Types de lieu proposés dans le formulaire d'ajout
const PLACE_TYPES = [
  'Restaurant', 'Café', 'Bar', 'Hôtel', 'Musée',
  'Parc', 'Marché', 'Shopping', 'Activité', 'Transport', 'Autre',
];

// Valeurs par défaut du formulaire d'ajout/modification de lieu
const EMPTY_FORM = {
  name: '', notes: '', type: 'Restaurant', price: 2,
  googleMapsLink: '', latitude: 48.854, longitude: 2.333,
  address: '', rating: 4.0, imageUrl: '',
};

// Affiche le niveau de prix (€ à €€€€)
function PriceTag({ price, color, textMuted }: { price: number; color: string; textMuted: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[1, 2, 3, 4].map(i => (
        <Text key={i} style={{ fontSize: 11, color: i <= price ? '#f7a84f' : textMuted, opacity: i <= price ? 1 : 0.3 }}>
          €
        </Text>
      ))}
    </View>
  );
}

// Écran détail d'une liste : ses lieux, la carte, le partage et les suggestions IA
export default function ListDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [list, setList] = useState<ListItem | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [showAddPlace, setShowAddPlace] = useState(false);
  const [editPlace, setEditPlace] = useState<Place | null>(null);
  const [showShare, setShowShare] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<Suggestion[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [pickedCoord, setPickedCoord] = useState<{ latitude: number; longitude: number } | null>(null);
  const [geocoding, setGeocoding] = useState(false);
  const { isLightTheme, C } = useAppTheme();
  const styles = useMemo(() => getStyles(C), [C]);

  const scrollRef = useRef<ScrollView>(null);
  const mapRef = useRef<MapView>(null);

  // Affiche la carte et la centre sur le lieu sélectionné
  const handlePlacePress = useCallback((place: any) => {
    setShowMap(true);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
    setTimeout(() => {
      mapRef.current?.animateToRegion({
        latitude: place.latitude,
        longitude: place.longitude,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      });
    }, showMap ? 50 : 300);
  }, [showMap]);

  // Recharge la liste courante depuis le store
  const reload = useCallback(async () => {
    const user = await getCurrentUser();
    if (!user) { router.replace('/auth'); return; }
    setUserId(user.id);
    const all = await getLists();
    const found = all.find(l => l.id === id);
    setList(found ?? null);
  }, [id]);

  useEffect(() => { reload(); }, [reload]);

  // Pré-remplit le formulaire pour modifier un lieu existant
  function openEdit(place: Place) {
    setEditPlace(place);
    setForm({
      name: place.name, notes: place.notes, type: place.type,
      price: place.price, googleMapsLink: place.googleMapsLink,
      latitude: place.latitude, longitude: place.longitude,
      address: place.address ?? '', rating: place.rating ?? 4.0,
      imageUrl: place.imageUrl ?? '',
    });
    setShowAddPlace(true);
  }

  // Crée ou met à jour le lieu selon le formulaire
  async function handleSavePlace() {
    if (!list || !form.name.trim()) return;
    if (editPlace) {
      await updatePlace(list.id, editPlace.id, { ...form });
    } else {
      await addPlace(list.id, { ...form });
    }
    setShowAddPlace(false);
    setEditPlace(null);
    setForm(EMPTY_FORM);
    reload();
  }

  // Demande confirmation puis supprime un lieu de la liste
  function handleDeletePlace(placeId: string) {
    if (!list) return;
    const place = list.places.find(p => p.id === placeId);
    Alert.alert(
      'Supprimer ce lieu ?',
      `"${place?.name ?? 'Ce lieu'}" sera supprimé définitivement.`,
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Supprimer', style: 'destructive', onPress: async () => {
          await deletePlace(list.id, placeId);
          reload();
        }},
      ],
    );
  }

  // Copie le lien de partage et notifie l'utilisateur
  async function handleShare() {
    if (!list || !userId) return;
    await Clipboard.setStringAsync(list.shareLink);
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 2000);
    await addNotification({
      userId,
      title: `Liste "${list.title}" partagée`,
      message: `Le lien de partage a été copié : ${list.shareLink}`,
      type: 'share',
      isRead: false,
    });
  }

  // Supprime définitivement la liste et revient en arrière
  async function handleDeleteList() {
    if (!list) return;
    await deleteList(list.id);
    router.back();
  }

  // Ouvre la modale IA et génère des suggestions basées sur cette liste
  async function handleOpenAI() {
    if (!list) return;
    setShowAI(true);
    setAiLoading(true);
    try {
      setAiSuggestions(await getSuggestionsForPlaces(list.places));
    } catch {
      Alert.alert('Erreur', 'Impossible de générer des suggestions.');
      setAiSuggestions([]);
    } finally {
      setAiLoading(false);
    }
  }

  // Bascule la liste entre publique et privée
  async function togglePublic() {
    if (!list) return;
    await updateList(list.id, { isPublic: !list.isPublic });
    reload();
  }

  if (!list) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: C.textMuted }}>Liste introuvable</Text>
        </View>
      </SafeAreaView>
    );
  }

  const mapLat = list.places[0]?.latitude ?? 48.854;
  const mapLng = list.places[0]?.longitude ?? 2.333;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: `${list.color}12` }]}>
          <View style={styles.headerTop}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={18} color={C.text} />
            </TouchableOpacity>
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ fontSize: 22 }}>{list.emoji}</Text>
              <Text style={styles.listTitle} numberOfLines={1}>{list.title}</Text>
            </View>
          </View>
          {!!list.description && (
            <Text style={styles.listDesc} numberOfLines={1}>{list.description}</Text>
          )}

          {/* Action buttons */}
          <View style={styles.actions}>
            <TouchableOpacity
              onPress={() => setShowMap(v => !v)}
              style={[styles.actionBtn, showMap && { backgroundColor: list.color }]}
            >
              <Ionicons name="map" size={14} color={showMap ? 'white' : C.text} />
              <Text style={[styles.actionBtnText, showMap && { color: 'white' }]}>Carte</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleOpenAI}
              style={[styles.actionBtn, { backgroundColor: 'rgba(34,211,168,0.15)' }]}
            >
              <Ionicons name="sparkles" size={14} color={C.accent} />
              <Text style={[styles.actionBtnText, { color: C.accent }]}>IA</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setShowShare(true)}
              style={styles.actionBtn}
            >
              <Ionicons name="share-social" size={14} color={C.text} />
              <Text style={styles.actionBtnText}>Partager</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Map */}
        {showMap && list.places.length > 0 && (
          <View style={styles.mapContainer}>
            <MapView
              ref={mapRef}
              style={styles.map}
              userInterfaceStyle={isLightTheme ? "light" : "dark"}
              region={{
                latitude: mapLat,
                longitude: mapLng,
                latitudeDelta: 0.05,
                longitudeDelta: 0.05,
              }}
            >
              {list.places.map(place => (
                <Marker
                  key={place.id}
                  coordinate={{ latitude: place.latitude, longitude: place.longitude }}
                  title={place.name}
                  description={place.type}
                  pinColor={list.color}
                />
              ))}
            </MapView>
          </View>
        )}

        {/* Places */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              {list.places.length} lieu{list.places.length > 1 ? 'x' : ''}
            </Text>
            <TouchableOpacity
              onPress={() => { setEditPlace(null); setForm(EMPTY_FORM); setShowAddPlace(true); }}
              style={[styles.addBtn, { backgroundColor: list.color }]}
            >
              <Ionicons name="add" size={14} color="white" />
              <Text style={styles.addBtnText}>Ajouter</Text>
            </TouchableOpacity>
          </View>

          {list.places.length === 0 && (
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Ionicons name="location" size={28} color={C.textMuted} />
              </View>
              <Text style={styles.emptyText}>Aucun lieu dans cette liste</Text>
              <TouchableOpacity
                onPress={() => setShowAddPlace(true)}
                style={[styles.addBtn, { backgroundColor: list.color, marginTop: 12 }]}
              >
                <Text style={styles.addBtnText}>Ajouter le premier lieu</Text>
              </TouchableOpacity>
            </View>
          )}

          {list.places.map(place => (
            <TouchableOpacity 
              key={place.id} 
              style={styles.placeCard}
              activeOpacity={0.8}
              onPress={() => handlePlacePress(place)}
            >
              {!!place.imageUrl && (
                <View style={styles.placeImageWrap}>
                  <Image
                    source={{ uri: place.imageUrl }}
                    style={styles.placeImage}
                    resizeMode="cover"
                  />
                  <View style={styles.placeImageOverlay} />
                  <View style={styles.placeImageLabel}>
                    <Ionicons name="location" size={12} color={list.color} />
                    <Text style={styles.placeImageName}>{place.name}</Text>
                  </View>
                </View>
              )}
              <View style={styles.placeBody}>
                {!place.imageUrl && (
                  <View style={styles.placeNoImgHeader}>
                    <View style={[styles.placeIcon, { backgroundColor: `${list.color}20` }]}>
                      <Ionicons name="location" size={18} color={list.color} />
                    </View>
                    <Text style={styles.placeName}>{place.name}</Text>
                  </View>
                )}
                <View style={styles.placeTags}>
                  <View style={[styles.placeTypeBadge, { backgroundColor: `${list.color}20` }]}>
                    <Text style={[styles.placeTypeText, { color: list.color }]}>{place.type}</Text>
                  </View>
                  <PriceTag price={place.price} color={list.color} textMuted={C.textMuted} />
                  {!!place.rating && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                      <Ionicons name="star" size={11} color="#f7a84f" />
                      <Text style={{ fontSize: 11, color: '#f7a84f', fontWeight: '600' }}>
                        {place.rating.toFixed(1)}
                      </Text>
                    </View>
                  )}
                </View>
                {!!place.address && (
                  <Text style={styles.placeAddress}>{place.address}</Text>
                )}
                {!!place.notes && (
                  <Text style={styles.placeNotes}>{place.notes}</Text>
                )}
                <View style={styles.placeActions}>
                  {!!place.googleMapsLink && (
                    <TouchableOpacity
                      onPress={() => Linking.openURL(place.googleMapsLink)}
                      style={styles.mapsBtn}
                    >
                      <Ionicons name="navigate" size={12} color="#4f8ef7" />
                      <Text style={styles.mapsBtnText}>Maps</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity onPress={() => openEdit(place)} style={styles.editBtn}>
                    <Ionicons name="pencil" size={12} color={C.textMuted} />
                    <Text style={styles.editBtnText}>Modifier</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleDeletePlace(place.id)}
                    style={styles.deleteBtn}
                  >
                    <Ionicons name="trash" size={12} color={C.destructive} />
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
          ))}

          {/* Danger zone */}
          <View style={styles.dangerZone}>
            <Text style={styles.dangerLabel}>Zone de danger</Text>
            <TouchableOpacity
              onPress={() => setShowDeleteConfirm(true)}
              style={styles.dangerBtn}
            >
              <Ionicons name="trash" size={14} color={C.destructive} />
              <Text style={styles.dangerBtnText}>Supprimer cette liste</Text>
            </TouchableOpacity>
          </View>
          <View style={{ height: 24 }} />
        </View>
      </ScrollView>

      {/* Add / edit place modal */}
      <Modal
        visible={showAddPlace}
        transparent
        animationType="slide"
        onRequestClose={() => { setShowAddPlace(false); setEditPlace(null); }}
      >
        <Pressable
          style={styles.overlay}
          onPress={() => { setShowAddPlace(false); setEditPlace(null); }}
        >
          <Pressable style={styles.sheet} onPress={e => e.stopPropagation()}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>
                {editPlace ? 'Modifier le lieu' : 'Ajouter un lieu'}
              </Text>
              <TouchableOpacity onPress={() => { setShowAddPlace(false); setEditPlace(null); }}>
                <Ionicons name="close" size={22} color={C.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {[
                { label: 'Nom *', key: 'name', placeholder: 'Ex : Le Comptoir' },
                { label: 'Adresse', key: 'address', placeholder: 'Ex : 12 Rue de la Paix' },
                { label: 'Notes', key: 'notes', placeholder: 'Vos impressions...' },
                { label: 'Lien Google Maps', key: 'googleMapsLink', placeholder: 'https://maps.google.com/...' },
                { label: 'URL Image', key: 'imageUrl', placeholder: 'https://...' },
              ].map(field => (
                <View key={field.key} style={styles.field}>
                  <Text style={styles.fieldLabel}>{field.label}</Text>
                  <TextInput
                    value={(form as any)[field.key]}
                    onChangeText={v => setForm(f => ({ ...f, [field.key]: v }))}
                    placeholder={field.placeholder}
                    placeholderTextColor={C.textMuted}
                    style={styles.fieldInput}
                  />
                </View>
              ))}

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Type</Text>
                <View style={styles.typeGrid}>
                  {PLACE_TYPES.map(t => (
                    <TouchableOpacity
                      key={t}
                      onPress={() => setForm(f => ({ ...f, type: t }))}
                      style={[
                        styles.typeBtn,
                        form.type === t && { backgroundColor: list.color, borderColor: list.color },
                      ]}
                    >
                      <Text
                        style={[
                          styles.typeBtnText,
                          form.type === t && { color: 'white', fontWeight: '600' },
                        ]}
                      >
                        {t}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Niveau de prix</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {[1, 2, 3, 4].map(p => (
                    <TouchableOpacity
                      key={p}
                      onPress={() => setForm(f => ({ ...f, price: p }))}
                      style={[
                        styles.priceBtn,
                        form.price === p && { borderColor: '#f7a84f', backgroundColor: 'rgba(247,168,79,0.1)' },
                      ]}
                    >
                      <Text style={{ color: '#f7a84f', fontWeight: '600', fontSize: 12 }}>
                        {'€'.repeat(p)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.field}>
                <View style={styles.coordsHeader}>
                  <Text style={styles.fieldLabel}>Coordonnées</Text>
                  <TouchableOpacity
                    onPress={() => {
                      setPickedCoord(null);
                      setShowMapPicker(true);
                    }}
                    style={[styles.mapPickerBtn, { borderColor: list.color }]}
                  >
                    <Ionicons name="map" size={13} color={list.color} />
                    <Text style={[styles.mapPickerBtnText, { color: list.color }]}>
                      Choisir sur la carte
                    </Text>
                  </TouchableOpacity>
                </View>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  {[
                    { label: 'Latitude', key: 'latitude' },
                    { label: 'Longitude', key: 'longitude' },
                  ].map(f => (
                    <View key={f.key} style={{ flex: 1 }}>
                      <Text style={[styles.fieldLabel, { marginBottom: 4 }]}>{f.label}</Text>
                      <TextInput
                        value={String((form as any)[f.key])}
                        onChangeText={v =>
                          setForm(prev => ({ ...prev, [f.key]: parseFloat(v) || 0 }))
                        }
                        keyboardType="numeric"
                        style={styles.fieldInput}
                      />
                    </View>
                  ))}
                </View>
              </View>

              <TouchableOpacity
                onPress={handleSavePlace}
                disabled={!form.name.trim()}
                style={[
                  styles.saveBtn,
                  { backgroundColor: form.name.trim() ? list.color : C.muted },
                ]}
              >
                <Text style={styles.saveBtnText}>
                  {editPlace ? 'Enregistrer les modifications' : 'Ajouter le lieu'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Share modal */}
      <Modal
        visible={showShare}
        transparent
        animationType="slide"
        onRequestClose={() => setShowShare(false)}
      >
        <Pressable style={styles.overlay} onPress={() => setShowShare(false)}>
          <Pressable style={styles.sheet} onPress={e => e.stopPropagation()}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Partager la liste</Text>
              <TouchableOpacity onPress={() => setShowShare(false)}>
                <Ionicons name="close" size={22} color={C.textMuted} />
              </TouchableOpacity>
            </View>
            <View style={styles.shareLinkRow}>
              <Ionicons name="link" size={14} color={C.textMuted} />
              <Text style={styles.shareLinkText} numberOfLines={1}>{list.shareLink}</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
              <TouchableOpacity onPress={togglePublic} style={[
                styles.shareToggleBtn,
                list.isPublic && { backgroundColor: 'rgba(34,211,168,0.15)' },
              ]}>
                <Ionicons
                  name={list.isPublic ? 'globe' : 'lock-closed'}
                  size={14}
                  color={list.isPublic ? C.accent : C.textMuted}
                />
                <Text style={[styles.shareToggleText, list.isPublic && { color: C.accent }]}>
                  {list.isPublic ? 'Public' : 'Privé'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleShare} style={[
                styles.shareToggleBtn,
                shareCopied && { backgroundColor: 'rgba(34,211,168,0.15)' },
                !shareCopied && { backgroundColor: C.primary },
              ]}>
                <Ionicons
                  name={shareCopied ? 'checkmark' : 'share-social'}
                  size={14}
                  color={shareCopied ? C.accent : 'white'}
                />
                <Text style={[
                  styles.shareToggleText,
                  { color: shareCopied ? C.accent : 'white' },
                ]}>
                  {shareCopied ? 'Copié !' : 'Copier'}
                </Text>
              </TouchableOpacity>
            </View>
            <View style={styles.collaboratorsRow}>
              <Ionicons name="people" size={14} color={C.textMuted} />
              <Text style={styles.collaboratorsText}>
                {list.collaborators.length === 0
                  ? 'Aucun collaborateur'
                  : `${list.collaborators.length} collaborateur(s)`}
              </Text>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* AI modal */}
      <Modal
        visible={showAI}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAI(false)}
      >
        <Pressable style={styles.overlay} onPress={() => setShowAI(false)}>
          <Pressable style={styles.sheet} onPress={e => e.stopPropagation()}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="sparkles" size={18} color={C.accent} />
                <Text style={styles.sheetTitle}>Suggestions IA</Text>
              </View>
              <TouchableOpacity onPress={() => setShowAI(false)}>
                <Ionicons name="close" size={22} color={C.textMuted} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.fieldLabel, { marginBottom: 16 }]}>
              Lieux similaires à ajouter à "{list.title}" :
            </Text>
            {aiLoading ? (
              <View style={{ alignItems: 'center', paddingVertical: 32, gap: 12 }}>
                <ActivityIndicator color={C.accent} />
                <Text style={styles.emptyText}>Génération des suggestions…</Text>
              </View>
            ) : aiSuggestions.length === 0 ? (
              <View style={styles.empty}>
                <View style={styles.emptyIcon}>
                  <Ionicons name="sparkles-outline" size={28} color={C.textMuted} />
                </View>
                <Text style={styles.emptyText}>Aucune suggestion pour l'instant</Text>
              </View>
            ) : (
            aiSuggestions.map((sug, i) => (
              <View key={i} style={styles.aiItem}>
                <View style={[styles.aiIcon, { backgroundColor: `${list.color}20` }]}>
                  <Ionicons name="location" size={16} color={list.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.aiName}>{sug.name}</Text>
                  <Text style={[styles.aiReason, { color: C.accent }]}>{sug.reason}</Text>
                </View>
                <TouchableOpacity
                  onPress={async () => {
                    await addPlace(list.id, {
                      name: sug.name, notes: sug.reason, type: sug.type,
                      price: sug.price,
                      googleMapsLink: `https://maps.google.com/?q=${encodeURIComponent(sug.name)}`,
                      latitude: sug.lat, longitude: sug.lng,
                      address: sug.address, rating: sug.rating,
                    });
                    reload();
                    setShowAI(false);
                  }}
                  style={styles.aiAddBtn}
                >
                  <Text style={{ color: C.accent, fontSize: 12, fontWeight: '600' }}>+ Ajouter</Text>
                </TouchableOpacity>
              </View>
            )))}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Map picker modal */}
      <Modal
        visible={showMapPicker}
        animationType="slide"
        onRequestClose={() => setShowMapPicker(false)}
      >
        <View style={{ flex: 1, backgroundColor: C.bg }}>
          <SafeAreaView edges={['top']} style={{ backgroundColor: C.card, borderBottomWidth: 1, borderBottomColor: C.border }}>
            <View style={styles.pickerHeader}>
              <TouchableOpacity onPress={() => setShowMapPicker(false)} style={styles.pickerHeaderBtn}>
                <Text style={{ color: C.textMuted, fontSize: 15 }}>Annuler</Text>
              </TouchableOpacity>
              <Text style={styles.pickerTitle}>Choisir un emplacement</Text>
              <TouchableOpacity
                onPress={async () => {
                  if (!pickedCoord) return;
                  setForm(f => ({
                    ...f,
                    latitude: pickedCoord.latitude,
                    longitude: pickedCoord.longitude,
                  }));
                  setGeocoding(true);
                  try {
                    const res = await fetch(
                      `https://nominatim.openstreetmap.org/reverse?lat=${pickedCoord.latitude}&lon=${pickedCoord.longitude}&format=json`,
                      { headers: { 'Accept-Language': 'fr' } },
                    );
                    const data = await res.json();
                    if (data.display_name) {
                      setForm(f => ({ ...f, address: data.display_name }));
                    }
                  } catch {}
                  setGeocoding(false);
                  setShowMapPicker(false);
                }}
                disabled={!pickedCoord || geocoding}
                style={styles.pickerHeaderBtn}
              >
                <Text style={{
                  fontSize: 15, fontWeight: '700',
                  color: pickedCoord ? list.color : C.textMuted,
                }}>
                  {geocoding ? 'Chargement…' : 'Confirmer'}
                </Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>

          {/* Hint */}
          {!pickedCoord && (
            <View style={styles.pickerHint}>
              <Ionicons name="finger-print" size={14} color={C.textMuted} />
              <Text style={styles.pickerHintText}>Appuyez sur la carte pour choisir un lieu</Text>
            </View>
          )}

          <MapView
            style={{ flex: 1 }}
            userInterfaceStyle={isLightTheme ? "light" : "dark"}
            initialRegion={{
              latitude: form.latitude || 48.854,
              longitude: form.longitude || 2.333,
              latitudeDelta: 0.05,
              longitudeDelta: 0.05,
            }}
            onPress={e => setPickedCoord(e.nativeEvent.coordinate)}
          >
            {pickedCoord && (
              <Marker coordinate={pickedCoord} pinColor={list.color} />
            )}
          </MapView>

          {/* Bottom confirm bar */}
          {pickedCoord && (
            <SafeAreaView edges={['bottom']} style={{ backgroundColor: C.card, borderTopWidth: 1, borderTopColor: C.border }}>
              <View style={styles.pickerBottom}>
                <View>
                  <Text style={styles.pickerCoordsLabel}>Emplacement sélectionné</Text>
                  <Text style={styles.pickerCoords}>
                    {pickedCoord.latitude.toFixed(5)}, {pickedCoord.longitude.toFixed(5)}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={async () => {
                    setForm(f => ({
                      ...f,
                      latitude: pickedCoord.latitude,
                      longitude: pickedCoord.longitude,
                    }));
                    setGeocoding(true);
                    try {
                      const res = await fetch(
                        `https://nominatim.openstreetmap.org/reverse?lat=${pickedCoord.latitude}&lon=${pickedCoord.longitude}&format=json`,
                        { headers: { 'Accept-Language': 'fr' } },
                      );
                      const data = await res.json();
                      if (data.display_name) {
                        setForm(f => ({ ...f, address: data.display_name }));
                      }
                    } catch {}
                    setGeocoding(false);
                    setShowMapPicker(false);
                  }}
                  disabled={geocoding}
                  style={[styles.pickerConfirmBtn, { backgroundColor: list.color }]}
                >
                  {geocoding ? (
                    <Text style={styles.pickerConfirmText}>Récupération de l'adresse…</Text>
                  ) : (
                    <>
                      <Ionicons name="checkmark" size={16} color="white" />
                      <Text style={styles.pickerConfirmText}>Utiliser cet emplacement</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </SafeAreaView>
          )}
        </View>
      </Modal>

      {/* Delete list confirm */}
      <Modal
        visible={showDeleteConfirm}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDeleteConfirm(false)}
      >
        <Pressable
          style={[styles.overlay, { justifyContent: 'center', paddingHorizontal: 32 }]}
          onPress={() => setShowDeleteConfirm(false)}
        >
          <Pressable style={styles.confirmDialog} onPress={e => e.stopPropagation()}>
            <Text style={styles.confirmTitle}>Supprimer la liste ?</Text>
            <Text style={styles.confirmMsg}>
              "{list.title}" et ses {list.places.length} lieu(x) seront supprimés définitivement.
            </Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                onPress={() => setShowDeleteConfirm(false)}
                style={styles.cancelBtn}
              >
                <Text style={{ color: C.text, fontWeight: '600' }}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleDeleteList} style={styles.confirmDeleteBtn}>
                <Text style={{ color: 'white', fontWeight: '600' }}>Supprimer</Text>
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
  header: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16 },
  headerTop: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 6 },
  backBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: C.muted, alignItems: 'center', justifyContent: 'center',
  },
  listTitle: { fontSize: 20, fontWeight: '700', color: C.text, flex: 1 },
  listDesc: { fontSize: 12, color: C.textMuted, marginBottom: 12, marginLeft: 48 },
  actions: { flexDirection: 'row', gap: 8 },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 9, borderRadius: 12, backgroundColor: C.muted,
  },
  actionBtnText: { fontSize: 13, fontWeight: '600', color: C.text },
  mapContainer: { marginHorizontal: 16, marginBottom: 16, borderRadius: 16, overflow: 'hidden' },
  map: { height: 200 },
  section: { paddingHorizontal: 16 },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 12,
  },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: C.text },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10,
  },
  addBtnText: { color: 'white', fontSize: 12, fontWeight: '600' },
  empty: { alignItems: 'center', paddingVertical: 48 },
  emptyIcon: {
    width: 64, height: 64, borderRadius: 16,
    backgroundColor: C.muted, alignItems: 'center',
    justifyContent: 'center', marginBottom: 12,
  },
  emptyText: { color: C.textMuted, fontSize: 14 },
  placeCard: {
    backgroundColor: C.card, borderRadius: 16,
    borderWidth: 1, borderColor: C.border,
    marginBottom: 12, overflow: 'hidden',
  },
  placeImageWrap: { position: 'relative', height: 140 },
  placeImage: { width: '100%', height: 140, opacity: 0.8 },
  placeImageOverlay: {
    ...StyleSheet.absoluteFillObject,
    background: undefined,
    backgroundColor: 'transparent',
  },
  placeImageLabel: {
    position: 'absolute', bottom: 8, left: 12,
    flexDirection: 'row', alignItems: 'center', gap: 4,
  },
  placeImageName: { fontSize: 12, fontWeight: '600', color: 'white' },
  placeBody: { padding: 12 },
  placeNoImgHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  placeIcon: {
    width: 40, height: 40, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  placeName: { fontSize: 15, fontWeight: '600', color: C.text, flex: 1 },
  placeTags: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  placeTypeBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  placeTypeText: { fontSize: 11, fontWeight: '600' },
  placeAddress: { fontSize: 12, color: C.textMuted, marginBottom: 4 },
  placeNotes: { fontSize: 13, color: C.text, opacity: 0.8, marginBottom: 8 },
  placeActions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  mapsBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
    backgroundColor: 'rgba(79,142,247,0.15)',
  },
  mapsBtnText: { color: '#4f8ef7', fontSize: 12, fontWeight: '600' },
  editBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
    backgroundColor: C.muted,
  },
  editBtnText: { color: C.textMuted, fontSize: 12 },
  deleteBtn: {
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
    backgroundColor: 'rgba(247,95,95,0.1)', marginLeft: 'auto',
  },
  dangerZone: {
    marginTop: 16, padding: 16, borderRadius: 16,
    borderWidth: 1, borderColor: 'rgba(247,95,95,0.2)',
    backgroundColor: 'rgba(247,95,95,0.04)',
  },
  dangerLabel: { fontSize: 12, color: C.destructive, fontWeight: '600', marginBottom: 8 },
  dangerBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10,
    backgroundColor: 'rgba(247,95,95,0.15)', alignSelf: 'flex-start',
  },
  dangerBtnText: { color: C.destructive, fontSize: 13, fontWeight: '600' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: C.card, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, paddingBottom: 32, borderWidth: 1, borderColor: C.border,
    maxHeight: '90%',
  },
  sheetHandle: {
    width: 36, height: 4, borderRadius: 2, backgroundColor: C.border,
    alignSelf: 'center', marginBottom: 16,
  },
  sheetHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 20,
  },
  sheetTitle: { fontSize: 17, fontWeight: '700', color: C.text },
  field: { marginBottom: 16 },
  fieldLabel: { fontSize: 12, color: C.textMuted, marginBottom: 6 },
  fieldInput: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: C.border,
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 13,
    color: C.text, fontSize: 14,
  },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeBtn: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10,
    backgroundColor: C.muted, borderWidth: 1, borderColor: 'transparent',
  },
  typeBtnText: { fontSize: 12, color: C.textMuted },
  priceBtn: {
    flex: 1, paddingVertical: 9, borderRadius: 10,
    borderWidth: 2, borderColor: 'transparent',
    backgroundColor: C.muted, alignItems: 'center',
  },
  saveBtn: {
    borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginTop: 8,
  },
  saveBtnText: { color: 'white', fontWeight: '700', fontSize: 16 },
  shareLinkRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: 12, borderRadius: 12, backgroundColor: C.muted,
    borderWidth: 1, borderColor: C.border, marginBottom: 16,
  },
  shareLinkText: { flex: 1, fontSize: 13, color: C.text },
  shareToggleBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 11, borderRadius: 12, backgroundColor: C.muted,
  },
  shareToggleText: { fontSize: 13, fontWeight: '600', color: C.textMuted },
  collaboratorsRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: 12, borderRadius: 12, backgroundColor: C.muted,
    borderWidth: 1, borderColor: C.border,
  },
  collaboratorsText: { fontSize: 13, color: C.textMuted },
  aiItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: C.muted, borderRadius: 12, padding: 12, marginBottom: 12,
  },
  aiIcon: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  aiName: { fontSize: 14, fontWeight: '600', color: C.text },
  aiReason: { fontSize: 11, marginTop: 2 },
  aiAddBtn: {
    backgroundColor: 'rgba(34,211,168,0.15)', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 6,
  },
  confirmDialog: {
    backgroundColor: C.card, borderRadius: 20, padding: 24,
    width: '100%', borderWidth: 1, borderColor: C.border,
  },
  confirmTitle: { fontSize: 17, fontWeight: '700', color: C.text, marginBottom: 8 },
  confirmMsg: { fontSize: 14, color: C.textMuted, marginBottom: 20, lineHeight: 20 },
  cancelBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 12,
    backgroundColor: C.muted, alignItems: 'center',
  },
  confirmDeleteBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 12,
    backgroundColor: C.destructive, alignItems: 'center',
  },
  coordsHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 8,
  },
  mapPickerBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 8, borderWidth: 1,
  },
  mapPickerBtnText: { fontSize: 12, fontWeight: '600' },
  pickerHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14,
  },
  pickerHeaderBtn: { minWidth: 70 },
  pickerTitle: { fontSize: 16, fontWeight: '700', color: C.text },
  pickerHint: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 14, paddingVertical: 10,
  },
  pickerHintText: { fontSize: 13, color: C.textMuted },
  pickerBottom: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
  },
  pickerCoordsLabel: { fontSize: 11, color: C.textMuted, marginBottom: 2 },
  pickerCoords: { fontSize: 13, fontWeight: '600', color: C.text },
  pickerConfirmBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12,
  },
  pickerConfirmText: { color: 'white', fontWeight: '700', fontSize: 14 },
});
