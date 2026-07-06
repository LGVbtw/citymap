import AsyncStorage from '@react-native-async-storage/async-storage';

// Utilisateur du compte (login local)
export type User = {
  id: string;
  username: string;
  email: string;
  avatar?: string;
  bio?: string;
};

// Un lieu sauvegardé dans une liste
export type Place = {
  id: string;
  listId: string;
  name: string;
  notes: string;
  type: string;
  price: number;
  googleMapsLink: string;
  latitude: number;
  longitude: number;
  address?: string;
  rating?: number;
  imageUrl?: string;
  addedAt: string;
};

// Une liste de lieux (ex: "Favoris")
export type ListItem = {
  id: string;
  userId: string;
  title: string;
  description: string;
  shareLink: string;
  emoji: string;
  color: string;
  isPublic: boolean;
  collaborators: string[];
  createdAt: string;
  places: Place[];
};

// Une notification affichée dans l'onglet Alertes
export type Notification = {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'share' | 'invite' | 'update' | 'ai' | 'reminder';
  isRead: boolean;
  createdAt: string;
  actionId?: string;
};

// Clés utilisées pour stocker les données dans AsyncStorage
const USERS_KEY = 'placelist_users';
const SESSION_KEY = 'placelist_session';
const LISTS_KEY = 'placelist_lists';
const NOTIFS_KEY = 'placelist_notifs';
const SEEDED_KEY = 'placelist_seeded';

// Génère un id unique
function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// Helpers génériques pour lire/écrire du JSON dans AsyncStorage
async function getJSON<T>(key: string, fallback: T): Promise<T> {
  const val = await AsyncStorage.getItem(key);
  return val ? (JSON.parse(val) as T) : fallback;
}

async function setJSON<T>(key: string, value: T): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

// ---- Listes ----

// Récupère toutes les listes stockées
export async function getLists(): Promise<ListItem[]> {
  const lists = await getJSON<ListItem[]>(LISTS_KEY, []);
  // Purge old demo lists to satisfy the user's request
  if (lists.some(l => l.title === 'Paris Foodie 🇫🇷' || l.title === 'Tokyo Must-See 🇯🇵')) {
    const cleanedLists = lists.filter(l => l.title !== 'Paris Foodie 🇫🇷' && l.title !== 'Tokyo Must-See 🇯🇵' && l.title !== 'Activités Weekend');
    await setJSON(LISTS_KEY, cleanedLists);
    return cleanedLists;
  }
  return lists;
}

// Récupère les listes possédées ou partagées avec un utilisateur
export async function getUserLists(userId: string): Promise<ListItem[]> {
  const lists = await getLists();
  return lists.filter(l => l.userId === userId || l.collaborators.includes(userId));
}

// Crée une nouvelle liste
export async function createList(
  userId: string,
  title: string,
  description: string,
  emoji: string,
  color: string,
): Promise<ListItem> {
  const list: ListItem = {
    id: uuid(),
    userId,
    title,
    description,
    shareLink: `placelist.app/share/${uuid().slice(0, 8)}`,
    emoji,
    color,
    isPublic: false,
    collaborators: [],
    createdAt: new Date().toISOString(),
    places: [],
  };
  const lists = await getLists();
  lists.push(list);
  await setJSON(LISTS_KEY, lists);
  return list;
}

// Met à jour les champs d'une liste (titre, emoji, couleur...)
export async function updateList(listId: string, updates: Partial<ListItem>): Promise<void> {
  const lists = await getLists();
  const idx = lists.findIndex(l => l.id === listId);
  if (idx === -1) return;
  lists[idx] = { ...lists[idx], ...updates };
  await setJSON(LISTS_KEY, lists);
}

// Supprime une liste
export async function deleteList(listId: string): Promise<void> {
  const lists = await getLists();
  await setJSON(LISTS_KEY, lists.filter(l => l.id !== listId));
}

// ---- Lieux dans une liste ----

// Ajoute un lieu à une liste
export async function addPlace(
  listId: string,
  place: Omit<Place, 'id' | 'listId' | 'addedAt'>,
): Promise<Place> {
  const lists = await getLists();
  const idx = lists.findIndex(l => l.id === listId);
  if (idx === -1) throw new Error('List not found');
  const newPlace: Place = {
    ...place,
    id: uuid(),
    listId,
    addedAt: new Date().toISOString(),
  };
  lists[idx].places.push(newPlace);
  await setJSON(LISTS_KEY, lists);
  return newPlace;
}

// Met à jour un lieu (notes, prix, etc.)
export async function updatePlace(
  listId: string,
  placeId: string,
  updates: Partial<Place>,
): Promise<void> {
  const lists = await getLists();
  const li = lists.findIndex(l => l.id === listId);
  if (li === -1) return;
  const pi = lists[li].places.findIndex(p => p.id === placeId);
  if (pi === -1) return;
  lists[li].places[pi] = { ...lists[li].places[pi], ...updates };
  await setJSON(LISTS_KEY, lists);
}

// Supprime un lieu d'une liste
export async function deletePlace(listId: string, placeId: string): Promise<void> {
  const lists = await getLists();
  const idx = lists.findIndex(l => l.id === listId);
  if (idx === -1) return;
  lists[idx].places = lists[idx].places.filter(p => p.id !== placeId);
  await setJSON(LISTS_KEY, lists);
}

// ---- Compte utilisateur / session ----

// Renvoie l'utilisateur actuellement connecté (via la session stockée)
export async function getCurrentUser(): Promise<User | null> {
  const id = await AsyncStorage.getItem(SESSION_KEY);
  if (!id) return null;
  const users = await getJSON<User[]>(USERS_KEY, []);
  return users.find(u => u.id === id) ?? null;
}

// Connecte un utilisateur existant
export async function login(username: string, password: string): Promise<User | null> {
  const users = await getJSON<User[]>(USERS_KEY, []);
  const user = users.find(u => u.username === username);
  if (!user) return null;
  const stored = await AsyncStorage.getItem(`placelist_pw_${user.id}`);
  if (stored !== password) return null;
  await AsyncStorage.setItem(SESSION_KEY, user.id);
  return user;
}

// Crée un nouveau compte et le connecte
export async function register(
  username: string,
  email: string,
  password: string,
): Promise<User | null> {
  const users = await getJSON<User[]>(USERS_KEY, []);
  if (users.find(u => u.username === username)) return null;
  const user: User = { id: uuid(), username, email, avatar: '' };
  users.push(user);
  await setJSON(USERS_KEY, users);
  await AsyncStorage.setItem(`placelist_pw_${user.id}`, password);
  await AsyncStorage.setItem(SESSION_KEY, user.id);
  await seedDemoData(user.id, username);
  return user;
}

// Déconnecte l'utilisateur courant
export async function logout(): Promise<void> {
  await AsyncStorage.removeItem(SESSION_KEY);
}

// Met à jour le profil (username, avatar, bio...)
export async function updateUser(userId: string, updates: Partial<User>): Promise<void> {
  const users = await getJSON<User[]>(USERS_KEY, []);
  const idx = users.findIndex(u => u.id === userId);
  if (idx === -1) return;
  users[idx] = { ...users[idx], ...updates };
  await setJSON(USERS_KEY, users);
}

// Change le mot de passe d'un utilisateur
export async function changePassword(userId: string, newPassword: string): Promise<void> {
  await AsyncStorage.setItem(`placelist_pw_${userId}`, newPassword);
}

// ---- Notifications ----

// Récupère les notifications d'un utilisateur, plus récentes en premier
export async function getNotifs(userId: string): Promise<Notification[]> {
  const all = await getJSON<Notification[]>(NOTIFS_KEY, []);
  return all
    .filter(n => n.userId === userId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

// Ajoute une notification
export async function addNotification(
  notif: Omit<Notification, 'id' | 'createdAt'>,
): Promise<void> {
  const all = await getJSON<Notification[]>(NOTIFS_KEY, []);
  all.push({ ...notif, id: uuid(), createdAt: new Date().toISOString() });
  await setJSON(NOTIFS_KEY, all);
}

// Marque une notification comme lue
export async function markNotifRead(notifId: string): Promise<void> {
  const all = await getJSON<Notification[]>(NOTIFS_KEY, []);
  const idx = all.findIndex(n => n.id === notifId);
  if (idx !== -1) all[idx].isRead = true;
  await setJSON(NOTIFS_KEY, all);
}

// Marque toutes les notifications d'un utilisateur comme lues
export async function markAllNotifsRead(userId: string): Promise<void> {
  const all = await getJSON<Notification[]>(NOTIFS_KEY, []);
  all.forEach(n => {
    if (n.userId === userId) n.isRead = true;
  });
  await setJSON(NOTIFS_KEY, all);
}

// Supprime une notification
export async function deleteNotif(notifId: string): Promise<void> {
  const all = await getJSON<Notification[]>(NOTIFS_KEY, []);
  await setJSON(NOTIFS_KEY, all.filter(n => n.id !== notifId));
}

// ---- Données de démo ----

// Crée les données de base pour un nouveau compte (liste Favoris + notif de bienvenue)
async function seedDemoData(userId: string, username: string): Promise<void> {
  await createList(userId, 'Favoris', 'Mes lieux sauvegardés', '⭐', '#f7a84f');
  await addNotification({
    userId, title: 'Bienvenue sur PlaceList ! 👋',
    message: `Bonjour ${username} ! Explorez la carte et sauvegardez des lieux dans vos listes.`,
    type: 'ai', isRead: false,
  });
}

// Crée le compte de démo une seule fois au premier lancement de l'app
export async function initDemo(): Promise<void> {
  const already = await AsyncStorage.getItem(SEEDED_KEY);
  if (already) return;
  const users = await getJSON<User[]>(USERS_KEY, []);
  if (!users.find(u => u.username === 'demo')) {
    const demoUser: User = {
      id: 'demo-user-001',
      username: 'demo',
      email: 'demo@placelist.app',
      bio: 'Compte de démonstration',
    };
    users.push(demoUser);
    await setJSON(USERS_KEY, users);
    await AsyncStorage.setItem('placelist_pw_demo-user-001', 'demo123');
    await seedDemoData('demo-user-001', 'demo');
  }
  await AsyncStorage.setItem(SEEDED_KEY, '1');
}
