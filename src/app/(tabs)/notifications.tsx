import { useCallback, useEffect, useState, useMemo } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  Notification,
  deleteNotif,
  getCurrentUser,
  getNotifs,
  markAllNotifsRead,
  markNotifRead,
} from '../../store';
import { useAppTheme } from '../../context/ThemeContext';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

// Icône/couleurs affichées selon le type de notification
const NOTIF_META: Record<
  Notification['type'],
  { icon: IoniconName; bg: string; color: string }
> = {
  share: { icon: 'share-social', bg: 'rgba(79,142,247,0.15)', color: '#4f8ef7' },
  invite: { icon: 'people', bg: 'rgba(196,123,247,0.15)', color: '#c47bf7' },
  update: { icon: 'location', bg: 'rgba(247,168,79,0.15)', color: '#f7a84f' },
  ai: { icon: 'sparkles', bg: 'rgba(34,211,168,0.15)', color: '#22d3a8' },
  reminder: { icon: 'time', bg: 'rgba(247,168,79,0.15)', color: '#f7a84f' },
};

// Formate une date en "il y a X min/h/jours"
function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "À l'instant";
  if (mins < 60) return `Il y a ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  return `Il y a ${days} jour${days > 1 ? 's' : ''}`;
}

// Écran "Alertes" : liste des notifications de l'utilisateur
export default function NotificationsScreen() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const { C } = useAppTheme();
  const styles = useMemo(() => getStyles(C), [C]);

  // Recharge les notifications de l'utilisateur courant
  const reload = useCallback(async () => {
    const user = await getCurrentUser();
    if (!user) { router.replace('/auth'); return; }
    setUserId(user.id);
    setNotifs(await getNotifs(user.id));
  }, []);

  useEffect(() => { reload(); }, [reload]);

  // Marque une notification comme lue
  async function handleRead(id: string) {
    await markNotifRead(id);
    reload();
  }

  // Supprime une notification
  async function handleDelete(id: string) {
    await deleteNotif(id);
    reload();
  }

  // Marque toutes les notifications comme lues
  async function handleReadAll() {
    if (!userId) return;
    await markAllNotifsRead(userId);
    reload();
  }

  const displayed = filter === 'unread' ? notifs.filter(n => !n.isRead) : notifs;
  const unreadCount = notifs.filter(n => !n.isRead).length;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Notifications</Text>
          {unreadCount > 0 && (
            <Text style={styles.subtitle}>
              {unreadCount} non lue{unreadCount > 1 ? 's' : ''}
            </Text>
          )}
        </View>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={handleReadAll} style={styles.readAllBtn}>
            <Ionicons name="checkmark-done" size={14} color={C.textMuted} />
            <Text style={styles.readAllText}>Tout lire</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Filter tabs */}
      <View style={styles.filterRow}>
        {(['all', 'unread'] as const).map(f => (
          <TouchableOpacity
            key={f}
            onPress={() => setFilter(f)}
            style={[styles.filterTab, filter === f && styles.filterTabActive]}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f === 'all'
                ? 'Toutes'
                : `Non lues${unreadCount > 0 ? ` (${unreadCount})` : ''}`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.list}>
        {displayed.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Ionicons name="notifications-off" size={28} color={C.textMuted} />
            </View>
            <Text style={styles.emptyText}>
              {filter === 'unread' ? 'Aucune notification non lue' : 'Aucune notification'}
            </Text>
          </View>
        ) : (
          displayed.map(notif => {
            const meta = NOTIF_META[notif.type];
            return (
              <View
                key={notif.id}
                style={[
                  styles.notifCard,
                  !notif.isRead && {
                    backgroundColor: `${meta.color}08`,
                    borderColor: `${meta.color}30`,
                  },
                ]}
              >
                <View style={[styles.notifIcon, { backgroundColor: meta.bg }]}>
                  <Ionicons name={meta.icon} size={18} color={meta.color} />
                </View>

                <View style={{ flex: 1 }}>
                  <View style={styles.notifTitleRow}>
                    <Text
                      style={[styles.notifTitle, { fontWeight: notif.isRead ? '500' : '700' }]}
                      numberOfLines={1}
                    >
                      {notif.title}
                    </Text>
                    {!notif.isRead && (
                      <View style={[styles.unreadDot, { backgroundColor: meta.color }]} />
                    )}
                  </View>
                  <Text style={styles.notifMsg}>{notif.message}</Text>
                  <Text style={styles.notifTime}>{timeAgo(notif.createdAt)}</Text>

                  {notif.type === 'invite' && !notif.isRead && (
                    <View style={styles.inviteActions}>
                      <TouchableOpacity
                        onPress={() => handleRead(notif.id)}
                        style={styles.acceptBtn}
                      >
                        <Ionicons name="checkmark" size={12} color={C.accent} />
                        <Text style={[styles.inviteActionText, { color: C.accent }]}>Accepter</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleDelete(notif.id)}
                        style={styles.refuseBtn}
                      >
                        <Text style={[styles.inviteActionText, { color: C.destructive }]}>Refuser</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>

                <View style={styles.notifActions}>
                  {!notif.isRead && (
                    <TouchableOpacity onPress={() => handleRead(notif.id)} style={styles.actionBtn}>
                      <Ionicons name="checkmark" size={13} color={C.textMuted} />
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity onPress={() => handleDelete(notif.id)} style={styles.actionBtn}>
                    <Ionicons name="trash" size={13} color={C.textMuted} />
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
        <View style={{ height: 16 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (C: any) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12,
  },
  title: { fontSize: 22, fontWeight: '700', color: C.text },
  subtitle: { fontSize: 12, color: C.textMuted, marginTop: 2 },
  readAllBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10,
    backgroundColor: C.muted,
  },
  readAllText: { fontSize: 12, color: C.textMuted },
  filterRow: {
    flexDirection: 'row', marginHorizontal: 16,
    backgroundColor: C.muted, borderRadius: 12, padding: 4, marginBottom: 16,
  },
  filterTab: { flex: 1, paddingVertical: 8, borderRadius: 9, alignItems: 'center' },
  filterTabActive: { backgroundColor: C.card },
  filterText: { fontSize: 13, color: C.textMuted },
  filterTextActive: { color: C.text, fontWeight: '600' },
  list: { paddingHorizontal: 16 },
  empty: { alignItems: 'center', paddingTop: 64 },
  emptyIcon: {
    width: 64, height: 64, borderRadius: 16, backgroundColor: C.muted,
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  emptyText: { color: C.textMuted, fontSize: 14 },
  notifCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    backgroundColor: C.card, borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: C.border, marginBottom: 10,
  },
  notifIcon: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  notifTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  notifTitle: { fontSize: 14, color: C.text, flex: 1 },
  unreadDot: { width: 8, height: 8, borderRadius: 4 },
  notifMsg: { fontSize: 13, color: C.textMuted, lineHeight: 18, marginBottom: 4 },
  notifTime: { fontSize: 11, color: C.textMuted, opacity: 0.6 },
  inviteActions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  acceptBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10,
    backgroundColor: 'rgba(34,211,168,0.15)',
  },
  refuseBtn: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10,
    backgroundColor: 'rgba(247,95,95,0.1)',
  },
  inviteActionText: { fontSize: 12, fontWeight: '600' },
  notifActions: { flexDirection: 'column', gap: 6, flexShrink: 0 },
  actionBtn: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: C.muted, alignItems: 'center', justifyContent: 'center',
  },
});
