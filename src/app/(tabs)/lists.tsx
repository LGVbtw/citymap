import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
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
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  AI_SUGGESTIONS,
  ListItem,
  addNotification,
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

const LIST_COLORS = ['#4f8ef7', '#22d3a8', '#f7a84f', '#c47bf7', '#f75f5f', '#70d4f7'];
const LIST_EMOJIS = ['📍', '🍽️', '✈️', '🏖️', '🎯', '🛍️', '🎭', '🌿', '🍷', '🏔️', '🏛️', '🌆'];

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

export default function ListsScreen() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [username, setUsername] = useState('');
  const [lists, setLists] = useState<ListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newEmoji, setNewEmoji] = useState('📍');
  const [newColor, setNewColor] = useState('#4f8ef7');

  const reload = useCallback(async () => {
    const user = await getCurrentUser();
    if (!user) { router.replace('/auth'); return; }
    setUserId(user.id);
    setUsername(user.username);
    const l = await getUserLists(user.id);
    setLists(l);
    setLoading(false);
  }, []);

  useEffect(() => { reload(); }, [reload]);

  useFocusEffect(useCallback(() => { reload(); }, [reload]));

  const filtered = lists.filter(
    l =>
      l.title.toLowerCase().includes(search.toLowerCase()) ||
      l.description.toLowerCase().includes(search.toLowerCase()),
  );

  const totalPlaces = lists.flatMap(l => l.places).length;

  async function handleCreate() {
    if (!userId || !newTitle.trim()) return;
    await createList(userId, newTitle.trim(), newDesc.trim(), newEmoji, newColor);
    setShowCreate(false);
    setNewTitle('');
    setNewDesc('');
    setNewEmoji('📍');
    setNewColor('#4f8ef7');
    reload();
  }

  const stats: { label: string; value: number; icon: IoniconName; color: string }[] = [
    { label: 'Listes', value: lists.length, icon: 'layers', color: C.primary },
    { label: 'Lieux', value: totalPlaces, icon: 'location', color: C.accent },
    { label: 'Partagées', value: lists.filter(l => l.isPublic).length, icon: 'share-social', color: '#c47bf7' },
  ];

  if (loading) {
    return (
      <View style={[styles.safe, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={C.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Bonjour,</Text>
            <Text style={styles.username}>{username} 👋</Text>
          </View>
          <TouchableOpacity onPress={() => setShowAI(true)} style={styles.aiBtn}>
            <Ionicons name="sparkles" size={18} color={C.accent} />
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={styles.searchRow}>
          <Ionicons name="search" size={16} color={C.textMuted} style={{ marginRight: 8 }} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Rechercher une liste ou un lieu..."
            placeholderTextColor={C.textMuted}
            style={styles.searchInput}
          />
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          {stats.map(s => (
            <View key={s.label} style={styles.statCard}>
              <Ionicons name={s.icon} size={16} color={s.color} />
              <Text style={[styles.statValue, { color: s.color }]}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Lists */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Mes listes</Text>
            <TouchableOpacity onPress={() => setShowCreate(true)} style={styles.newBtn}>
              <Ionicons name="add" size={14} color="white" />
              <Text style={styles.newBtnText}>Nouvelle</Text>
            </TouchableOpacity>
          </View>

          {filtered.length === 0 ? (
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Ionicons name="location" size={28} color={C.textMuted} />
              </View>
              <Text style={styles.emptyText}>Aucune liste trouvée</Text>
              <Text style={styles.emptySubtext}>Créez votre première liste de lieux !</Text>
            </View>
          ) : (
            filtered.map(list => (
              <TouchableOpacity
                key={list.id}
                onPress={() => router.push(`/list/${list.id}` as any)}
                style={styles.listCard}
                activeOpacity={0.7}
              >
                <View style={[styles.listEmoji, { backgroundColor: `${list.color}22` }]}>
                  <Text style={{ fontSize: 22 }}>{list.emoji}</Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={styles.listTitleRow}>
                    <Text style={styles.listTitle} numberOfLines={1}>{list.title}</Text>
                    {list.isPublic && (
                      <View style={styles.publicBadge}>
                        <Text style={[styles.publicBadgeText, { color: C.primary }]}>PUBLIC</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.listDesc} numberOfLines={1}>
                    {list.description || 'Aucune description'}
                  </Text>
                  <View style={styles.listMeta}>
                    <Text style={[styles.listCount, { color: list.color }]}>
                      {list.places.length} lieu{list.places.length > 1 ? 'x' : ''}
                    </Text>
                    <Text style={styles.listDate}>
                      {new Date(list.createdAt).toLocaleDateString('fr-FR', {
                        day: 'numeric',
                        month: 'short',
                      })}
                    </Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={18} color={C.textMuted} />
              </TouchableOpacity>
            ))
          )}
        </View>
        <View style={{ height: 24 }} />
      </ScrollView>

      {/* Create list modal */}
      <Modal
        visible={showCreate}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCreate(false)}
      >
        <Pressable style={styles.overlay} onPress={() => setShowCreate(false)}>
          <Pressable style={styles.sheet} onPress={e => e.stopPropagation()}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Nouvelle liste</Text>
              <TouchableOpacity onPress={() => setShowCreate(false)}>
                <Ionicons name="close" size={22} color={C.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Titre *</Text>
                <TextInput
                  value={newTitle}
                  onChangeText={setNewTitle}
                  placeholder="Ex : Restaurants Paris"
                  placeholderTextColor={C.textMuted}
                  style={styles.fieldInput}
                />
              </View>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Description</Text>
                <TextInput
                  value={newDesc}
                  onChangeText={setNewDesc}
                  placeholder="Décrivez votre liste..."
                  placeholderTextColor={C.textMuted}
                  style={styles.fieldInput}
                />
              </View>

              <Text style={styles.fieldLabel}>Emoji</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginBottom: 20 }}
              >
                {LIST_EMOJIS.map(e => (
                  <TouchableOpacity
                    key={e}
                    onPress={() => setNewEmoji(e)}
                    style={[
                      styles.emojiBtn,
                      newEmoji === e && { backgroundColor: C.primary },
                    ]}
                  >
                    <Text style={{ fontSize: 20 }}>{e}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.fieldLabel}>Couleur</Text>
              <View style={styles.colorsRow}>
                {LIST_COLORS.map(c => (
                  <TouchableOpacity
                    key={c}
                    onPress={() => setNewColor(c)}
                    style={[
                      styles.colorDot,
                      { backgroundColor: c },
                      newColor === c && styles.colorDotActive,
                    ]}
                  />
                ))}
              </View>

              <TouchableOpacity
                onPress={handleCreate}
                disabled={!newTitle.trim()}
                style={[styles.createBtn, !newTitle.trim() && { opacity: 0.4 }]}
              >
                <Text style={styles.createBtnText}>Créer la liste</Text>
              </TouchableOpacity>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* AI suggestions modal */}
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
              Basé sur vos listes, voici des lieux à explorer :
            </Text>
            {AI_SUGGESTIONS.default.map((sug, i) => (
              <View key={i} style={styles.aiItem}>
                <View style={styles.aiIcon}>
                  <Ionicons name="location" size={18} color={C.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.aiName}>{sug.name}</Text>
                  <Text style={[styles.aiReason, { color: C.accent }]}>{sug.reason}</Text>
                  <Text style={styles.aiAddr}>{sug.address}</Text>
                </View>
                <TouchableOpacity
                  onPress={async () => {
                    if (!userId) return;
                    const userLists = await getUserLists(userId);
                    let favList = userLists.find(l => l.title === 'Favoris');
                    if (!favList) {
                      favList = await createList(userId, 'Favoris', 'Mes lieux favoris', '⭐', '#f7a84f');
                    }
                    if (!favList.places.some(p => p.name === sug.name)) {
                      await addPlaceToList(favList.id, {
                        name: sug.name, notes: sug.reason, type: sug.type,
                        price: sug.price,
                        googleMapsLink: `https://maps.google.com/?q=${encodeURIComponent(sug.name)}`,
                        latitude: sug.lat, longitude: sug.lng,
                        address: sug.address, rating: sug.rating,
                      });
                    }
                    await addNotification({
                      userId,
                      title: `✨ ${sug.name} ajouté !`,
                      message: `"${sug.name}" a été ajouté à votre liste Favoris.`,
                      type: 'ai',
                      isRead: false,
                    });
                    reload();
                  }}
                  style={styles.aiSaveBtn}
                >
                  <Text style={{ color: C.accent, fontSize: 12, fontWeight: '600' }}>+ Sauver</Text>
                </TouchableOpacity>
              </View>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12,
  },
  greeting: { fontSize: 12, color: C.textMuted, marginBottom: 2 },
  username: { fontSize: 22, fontWeight: '700', color: C.text },
  aiBtn: {
    width: 38, height: 38, borderRadius: 10,
    backgroundColor: 'rgba(34,211,168,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  searchRow: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, marginBottom: 16,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12, borderWidth: 1, borderColor: C.border,
    paddingHorizontal: 12,
  },
  searchInput: { flex: 1, paddingVertical: 11, color: C.text, fontSize: 14 },
  statsRow: { flexDirection: 'row', gap: 12, marginHorizontal: 16, marginBottom: 20 },
  statCard: {
    flex: 1, backgroundColor: C.card, borderRadius: 12,
    borderWidth: 1, borderColor: C.border, padding: 12,
  },
  statValue: { fontSize: 22, fontWeight: '700', marginTop: 4 },
  statLabel: { fontSize: 11, color: C.textMuted, marginTop: 2 },
  section: { paddingHorizontal: 16 },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 12,
  },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: C.text },
  newBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10,
    backgroundColor: C.primary,
  },
  newBtnText: { color: 'white', fontSize: 12, fontWeight: '600' },
  empty: { alignItems: 'center', paddingVertical: 48 },
  emptyIcon: {
    width: 64, height: 64, borderRadius: 16, backgroundColor: C.muted,
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  emptyText: { color: C.textMuted, fontSize: 14 },
  emptySubtext: { color: C.textMuted, fontSize: 12, marginTop: 4 },
  listCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: C.card, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: C.border, marginBottom: 12,
  },
  listEmoji: {
    width: 48, height: 48, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  listTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  listTitle: { fontSize: 15, fontWeight: '600', color: C.text, flex: 1 },
  publicBadge: {
    backgroundColor: 'rgba(79,142,247,0.15)', borderRadius: 4,
    paddingHorizontal: 5, paddingVertical: 2,
  },
  publicBadgeText: { fontSize: 10, fontWeight: '600' },
  listDesc: { color: C.textMuted, fontSize: 12, marginBottom: 4 },
  listMeta: { flexDirection: 'row', gap: 12 },
  listCount: { fontSize: 11, fontWeight: '600' },
  listDate: { fontSize: 11, color: C.textMuted },
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: C.card, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, paddingBottom: 32, borderWidth: 1, borderColor: C.border,
    maxHeight: '88%',
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
  emojiBtn: {
    width: 42, height: 42, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    marginRight: 8, backgroundColor: C.muted,
  },
  colorsRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  colorDot: { width: 36, height: 36, borderRadius: 18 },
  colorDotActive: { borderWidth: 3, borderColor: 'white' },
  createBtn: {
    backgroundColor: C.primary, borderRadius: 12,
    paddingVertical: 15, alignItems: 'center',
  },
  createBtnText: { color: 'white', fontWeight: '700', fontSize: 16 },
  aiItem: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    backgroundColor: C.muted, borderRadius: 12,
    padding: 12, marginBottom: 12,
  },
  aiIcon: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: 'rgba(34,211,168,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  aiName: { fontSize: 14, fontWeight: '600', color: C.text },
  aiReason: { fontSize: 11, marginTop: 2 },
  aiAddr: { fontSize: 11, color: C.textMuted, marginTop: 1 },
  aiSaveBtn: {
    backgroundColor: 'rgba(34,211,168,0.15)', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 6,
  },
});
