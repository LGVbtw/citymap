import { useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  User,
  addNotification,
  changePassword,
  getCurrentUser,
  getUserLists,
  logout,
  updateUser,
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

export default function ProfileScreen() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [listCount, setListCount] = useState(0);
  const [placeCount, setPlaceCount] = useState(0);
  const [publicCount, setPublicCount] = useState(0);
  const [editUsername, setEditUsername] = useState(false);
  const [editPw, setEditPw] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [usernameOk, setUsernameOk] = useState(false);
  const [pwOk, setPwOk] = useState(false);
  const [pwError, setPwError] = useState('');
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [notifPrefs, setNotifPrefs] = useState({
    share: true, invite: true, ai: true, reminder: false,
  });

  useEffect(() => {
    (async () => {
      const u = await getCurrentUser();
      if (!u) { router.replace('/auth'); return; }
      setUser(u);
      setNewUsername(u.username);
      const lists = await getUserLists(u.id);
      setListCount(lists.length);
      setPlaceCount(lists.flatMap(l => l.places).length);
      setPublicCount(lists.filter(l => l.isPublic).length);
    })();
  }, []);

  async function handleSaveUsername() {
    if (!user || !newUsername.trim() || newUsername.trim().length < 3) return;
    await updateUser(user.id, { username: newUsername.trim() });
    const updated = await getCurrentUser();
    setUser(updated);
    setEditUsername(false);
    setUsernameOk(true);
    setTimeout(() => setUsernameOk(false), 2500);
  }

  async function handleSavePw() {
    setPwError('');
    if (newPw.length < 6) { setPwError('Min. 6 caractères'); return; }
    if (newPw !== confirmPw) { setPwError('Les mots de passe ne correspondent pas'); return; }
    if (!user) return;
    await changePassword(user.id, newPw);
    setEditPw(false);
    setNewPw('');
    setConfirmPw('');
    setPwOk(true);
    setTimeout(() => setPwOk(false), 2500);
  }

  async function handleLogout() {
    await logout();
    router.replace('/auth');
  }

  if (!user) return null;

  const initials = user.username.slice(0, 2).toUpperCase();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Profile header */}
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.username}>{user.username}</Text>
            {!!user.email && <Text style={styles.email}>{user.email}</Text>}
            {!!user.bio && <Text style={styles.bio}>{user.bio}</Text>}
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          {[
            { label: 'Listes', value: listCount, color: C.primary },
            { label: 'Lieux', value: placeCount, color: C.accent },
            { label: 'Partagées', value: publicCount, color: '#c47bf7' },
          ].map(s => (
            <View key={s.label} style={styles.statCard}>
              <Text style={[styles.statValue, { color: s.color }]}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Account section */}
        <Text style={styles.sectionLabel}>COMPTE</Text>
        <View style={styles.settingsCard}>
          {/* Username */}
          <View style={styles.settingRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.settingLabel}>Nom d'utilisateur</Text>
              {editUsername ? (
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
                  <TextInput
                    value={newUsername}
                    onChangeText={setNewUsername}
                    autoCapitalize="none"
                    style={[styles.inlineInput, { flex: 1 }]}
                  />
                  <TouchableOpacity onPress={handleSaveUsername} style={styles.saveBtn}>
                    <Ionicons name="checkmark" size={16} color="white" />
                  </TouchableOpacity>
                </View>
              ) : (
                <Text style={styles.settingValue}>
                  {user.username}
                  {usernameOk ? (
                    <Text style={{ color: C.accent, fontSize: 12 }}> ✓ Sauvegardé</Text>
                  ) : null}
                </Text>
              )}
            </View>
            <TouchableOpacity
              onPress={() => { setEditUsername(e => !e); setPwError(''); }}
              style={styles.editBtn}
            >
              <Ionicons name={editUsername ? 'close' : 'pencil'} size={14} color={C.primary} />
            </TouchableOpacity>
          </View>

          <View style={styles.divider} />

          {/* Email */}
          <View style={styles.settingRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.settingLabel}>Email</Text>
              <Text style={styles.settingValue}>{user.email || '—'}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          {/* Password */}
          <View style={styles.settingRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.settingLabel}>Mot de passe</Text>
              {editPw ? (
                <View style={{ marginTop: 8, gap: 8 }}>
                  <TextInput
                    value={newPw}
                    onChangeText={setNewPw}
                    secureTextEntry
                    placeholder="Nouveau mot de passe"
                    placeholderTextColor={C.textMuted}
                    style={styles.inlineInput}
                  />
                  <TextInput
                    value={confirmPw}
                    onChangeText={setConfirmPw}
                    secureTextEntry
                    placeholder="Confirmer"
                    placeholderTextColor={C.textMuted}
                    style={styles.inlineInput}
                  />
                  {!!pwError && (
                    <Text style={{ color: C.destructive, fontSize: 12 }}>{pwError}</Text>
                  )}
                  <TouchableOpacity onPress={handleSavePw} style={styles.saveBtn}>
                    <Text style={{ color: 'white', fontWeight: '600', fontSize: 14 }}>
                      Changer le mot de passe
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <Text style={styles.settingValue}>
                  ••••••••
                  {pwOk ? (
                    <Text style={{ color: C.accent, fontSize: 12 }}> ✓ Modifié</Text>
                  ) : null}
                </Text>
              )}
            </View>
            <TouchableOpacity
              onPress={() => { setEditPw(e => !e); setPwError(''); setNewPw(''); setConfirmPw(''); }}
              style={styles.editBtn}
            >
              <Ionicons name={editPw ? 'close' : 'key'} size={14} color={C.primary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Notifications */}
        <Text style={styles.sectionLabel}>NOTIFICATIONS</Text>
        <View style={styles.settingsCard}>
          {[
            { key: 'share', label: 'Partages de listes', desc: "Quand quelqu'un partage avec vous" },
            { key: 'invite', label: 'Invitations', desc: 'Invitations à collaborer' },
            { key: 'ai', label: 'Suggestions IA', desc: 'Recommandations personnalisées' },
            { key: 'reminder', label: 'Rappels', desc: 'Rappels de lieux enregistrés' },
          ].map((pref, i, arr) => (
            <View key={pref.key}>
              <View style={[styles.settingRow, { paddingVertical: 14 }]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.settingValue}>{pref.label}</Text>
                  <Text style={[styles.settingLabel, { marginTop: 1 }]}>{pref.desc}</Text>
                </View>
                <Switch
                  value={notifPrefs[pref.key as keyof typeof notifPrefs]}
                  onValueChange={v =>
                    setNotifPrefs(p => ({ ...p, [pref.key]: v }))
                  }
                  trackColor={{ false: C.muted, true: C.primary }}
                  thumbColor="white"
                />
              </View>
              {i < arr.length - 1 && <View style={styles.divider} />}
            </View>
          ))}
        </View>

        {/* Logout */}
        <TouchableOpacity
          onPress={() => setShowLogoutConfirm(true)}
          style={styles.logoutBtn}
        >
          <Ionicons name="log-out" size={16} color={C.destructive} />
          <Text style={styles.logoutText}>Se déconnecter</Text>
        </TouchableOpacity>

        <Text style={styles.version}>PlaceList v1.0 · Données stockées localement</Text>
        <View style={{ height: 16 }} />
      </ScrollView>

      {/* Logout confirm modal */}
      <Modal
        visible={showLogoutConfirm}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLogoutConfirm(false)}
      >
        <Pressable
          style={styles.overlay}
          onPress={() => setShowLogoutConfirm(false)}
        >
          <Pressable style={styles.confirmDialog} onPress={e => e.stopPropagation()}>
            <Text style={styles.confirmTitle}>Se déconnecter ?</Text>
            <Text style={styles.confirmMsg}>
              Vous devrez vous reconnecter pour accéder à vos listes.
            </Text>
            <View style={styles.confirmActions}>
              <TouchableOpacity
                onPress={() => setShowLogoutConfirm(false)}
                style={styles.cancelBtn}
              >
                <Text style={{ color: C.text, fontWeight: '600' }}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleLogout} style={styles.confirmLogoutBtn}>
                <Text style={{ color: 'white', fontWeight: '600' }}>Déconnecter</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 20,
  },
  avatar: {
    width: 72, height: 72, borderRadius: 18,
    backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 26, fontWeight: '700', color: 'white' },
  username: { fontSize: 20, fontWeight: '700', color: C.text },
  email: { fontSize: 13, color: C.textMuted, marginTop: 2 },
  bio: { fontSize: 12, color: C.textMuted, marginTop: 4 },
  statsRow: { flexDirection: 'row', gap: 12, marginHorizontal: 16, marginBottom: 24 },
  statCard: {
    flex: 1, backgroundColor: C.card, borderRadius: 12,
    borderWidth: 1, borderColor: C.border,
    padding: 12, alignItems: 'center',
  },
  statValue: { fontSize: 22, fontWeight: '700' },
  statLabel: { fontSize: 11, color: C.textMuted, marginTop: 3 },
  sectionLabel: {
    fontSize: 11, color: C.textMuted, fontWeight: '600',
    letterSpacing: 0.8, paddingHorizontal: 16, marginBottom: 8,
  },
  settingsCard: {
    marginHorizontal: 16, marginBottom: 24,
    backgroundColor: C.card, borderRadius: 16,
    borderWidth: 1, borderColor: C.border, overflow: 'hidden',
  },
  settingRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
  },
  settingLabel: { fontSize: 12, color: C.textMuted },
  settingValue: { fontSize: 15, color: C.text, fontWeight: '500', marginTop: 1 },
  editBtn: { padding: 4 },
  inlineInput: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: C.border,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9,
    color: C.text, fontSize: 14,
  },
  saveBtn: {
    backgroundColor: C.primary, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 9,
    alignItems: 'center',
  },
  divider: { height: 1, backgroundColor: C.border },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginHorizontal: 16, marginBottom: 12,
    paddingVertical: 14, borderRadius: 16,
    backgroundColor: 'rgba(247,95,95,0.08)',
    borderWidth: 1, borderColor: 'rgba(247,95,95,0.2)',
  },
  logoutText: { color: C.destructive, fontWeight: '600', fontSize: 15 },
  version: {
    textAlign: 'center', color: C.textMuted, fontSize: 11,
    paddingHorizontal: 16, marginBottom: 4,
  },
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 32,
  },
  confirmDialog: {
    backgroundColor: C.card, borderRadius: 20,
    padding: 24, width: '100%',
    borderWidth: 1, borderColor: C.border,
  },
  confirmTitle: { fontSize: 17, fontWeight: '700', color: C.text, marginBottom: 8 },
  confirmMsg: { fontSize: 14, color: C.textMuted, marginBottom: 20, lineHeight: 20 },
  confirmActions: { flexDirection: 'row', gap: 12 },
  cancelBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 12,
    backgroundColor: C.muted, alignItems: 'center',
  },
  confirmLogoutBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 12,
    backgroundColor: C.destructive, alignItems: 'center',
  },
});
