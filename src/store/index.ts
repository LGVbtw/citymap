import AsyncStorage from '@react-native-async-storage/async-storage';

export type User = {
  id: string;
  username: string;
  email: string;
  avatar?: string;
  bio?: string;
};

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

const USERS_KEY = 'placelist_users';
const SESSION_KEY = 'placelist_session';
const LISTS_KEY = 'placelist_lists';
const NOTIFS_KEY = 'placelist_notifs';
const SEEDED_KEY = 'placelist_seeded';

function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

async function getJSON<T>(key: string, fallback: T): Promise<T> {
  const val = await AsyncStorage.getItem(key);
  return val ? (JSON.parse(val) as T) : fallback;
}

async function setJSON<T>(key: string, value: T): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

export async function getLists(): Promise<ListItem[]> {
  return getJSON<ListItem[]>(LISTS_KEY, []);
}

export async function getNotifs(userId: string): Promise<Notification[]> {
  const all = await getJSON<Notification[]>(NOTIFS_KEY, []);
  return all
    .filter(n => n.userId === userId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getCurrentUser(): Promise<User | null> {
  const id = await AsyncStorage.getItem(SESSION_KEY);
  if (!id) return null;
  const users = await getJSON<User[]>(USERS_KEY, []);
  return users.find(u => u.id === id) ?? null;
}

export async function login(username: string, password: string): Promise<User | null> {
  const users = await getJSON<User[]>(USERS_KEY, []);
  const user = users.find(u => u.username === username);
  if (!user) return null;
  const stored = await AsyncStorage.getItem(`placelist_pw_${user.id}`);
  if (stored !== password) return null;
  await AsyncStorage.setItem(SESSION_KEY, user.id);
  return user;
}

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

export async function logout(): Promise<void> {
  await AsyncStorage.removeItem(SESSION_KEY);
}

export async function updateUser(userId: string, updates: Partial<User>): Promise<void> {
  const users = await getJSON<User[]>(USERS_KEY, []);
  const idx = users.findIndex(u => u.id === userId);
  if (idx === -1) return;
  users[idx] = { ...users[idx], ...updates };
  await setJSON(USERS_KEY, users);
}

export async function changePassword(userId: string, newPassword: string): Promise<void> {
  await AsyncStorage.setItem(`placelist_pw_${userId}`, newPassword);
}

export async function getUserLists(userId: string): Promise<ListItem[]> {
  const lists = await getLists();
  return lists.filter(l => l.userId === userId || l.collaborators.includes(userId));
}

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

export async function updateList(listId: string, updates: Partial<ListItem>): Promise<void> {
  const lists = await getLists();
  const idx = lists.findIndex(l => l.id === listId);
  if (idx === -1) return;
  lists[idx] = { ...lists[idx], ...updates };
  await setJSON(LISTS_KEY, lists);
}

export async function deleteList(listId: string): Promise<void> {
  const lists = await getLists();
  await setJSON(LISTS_KEY, lists.filter(l => l.id !== listId));
}

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

export async function deletePlace(listId: string, placeId: string): Promise<void> {
  const lists = await getLists();
  const idx = lists.findIndex(l => l.id === listId);
  if (idx === -1) return;
  lists[idx].places = lists[idx].places.filter(p => p.id !== placeId);
  await setJSON(LISTS_KEY, lists);
}

export async function addNotification(
  notif: Omit<Notification, 'id' | 'createdAt'>,
): Promise<void> {
  const all = await getJSON<Notification[]>(NOTIFS_KEY, []);
  all.push({ ...notif, id: uuid(), createdAt: new Date().toISOString() });
  await setJSON(NOTIFS_KEY, all);
}

export async function markNotifRead(notifId: string): Promise<void> {
  const all = await getJSON<Notification[]>(NOTIFS_KEY, []);
  const idx = all.findIndex(n => n.id === notifId);
  if (idx !== -1) all[idx].isRead = true;
  await setJSON(NOTIFS_KEY, all);
}

export async function markAllNotifsRead(userId: string): Promise<void> {
  const all = await getJSON<Notification[]>(NOTIFS_KEY, []);
  all.forEach(n => {
    if (n.userId === userId) n.isRead = true;
  });
  await setJSON(NOTIFS_KEY, all);
}

export async function deleteNotif(notifId: string): Promise<void> {
  const all = await getJSON<Notification[]>(NOTIFS_KEY, []);
  await setJSON(NOTIFS_KEY, all.filter(n => n.id !== notifId));
}

async function seedDemoData(userId: string, username: string): Promise<void> {
  const list1 = await createList(userId, 'Paris Foodie 🇫🇷', 'Mes restaurants préférés à Paris', '🍽️', '#4f8ef7');
  await addPlace(list1.id, {
    name: 'Le Comptoir du Relais',
    notes: 'Bistrot parisien authentique, réservation indispensable',
    type: 'Restaurant', price: 3,
    googleMapsLink: 'https://maps.google.com/?q=Le+Comptoir+du+Relais+Paris',
    latitude: 48.8534, longitude: 2.3388,
    address: "9 Carrefour de l'Odéon, 75006 Paris",
    rating: 4.7,
    imageUrl: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=400&h=300&fit=crop&auto=format',
  });
  await addPlace(list1.id, {
    name: 'Brasserie Lipp',
    notes: 'Brasserie historique de Saint-Germain, ambiance incroyable',
    type: 'Restaurant', price: 3,
    googleMapsLink: 'https://maps.google.com/?q=Brasserie+Lipp+Paris',
    latitude: 48.8543, longitude: 2.3333,
    address: '151 Bd Saint-Germain, 75006 Paris',
    rating: 4.5,
    imageUrl: 'https://images.unsplash.com/photo-1550966871-3ed3cdb5ed0c?w=400&h=300&fit=crop&auto=format',
  });
  await addPlace(list1.id, {
    name: 'Café de Flore',
    notes: 'Café littéraire iconique, petit déjeuner incontournable',
    type: 'Café', price: 2,
    googleMapsLink: 'https://maps.google.com/?q=Café+de+Flore+Paris',
    latitude: 48.854, longitude: 2.3326,
    address: '172 Bd Saint-Germain, 75006 Paris',
    rating: 4.3,
    imageUrl: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400&h=300&fit=crop&auto=format',
  });

  const list2 = await createList(userId, 'Tokyo Must-See 🇯🇵', 'Endroits incontournables pour mon voyage', '✈️', '#22d3a8');
  await addPlace(list2.id, {
    name: 'Tsukiji Outer Market',
    notes: 'Marché aux poissons, sushis du matin absolument frais',
    type: 'Marché', price: 2,
    googleMapsLink: 'https://maps.google.com/?q=Tsukiji+Market+Tokyo',
    latitude: 35.6655, longitude: 139.7707,
    address: '4 Chome-16-2 Tsukiji, Chuo City, Tokyo',
    rating: 4.8,
    imageUrl: 'https://images.unsplash.com/photo-1553621042-f6e147245754?w=400&h=300&fit=crop&auto=format',
  });
  await addPlace(list2.id, {
    name: 'Shinjuku Gyoen',
    notes: 'Jardin national magnifique, parfait pour les cerisiers',
    type: 'Parc', price: 1,
    googleMapsLink: 'https://maps.google.com/?q=Shinjuku+Gyoen+Tokyo',
    latitude: 35.6851, longitude: 139.71,
    address: 'Naitomachi, Shinjuku City, Tokyo',
    rating: 4.7,
    imageUrl: 'https://images.unsplash.com/photo-1522383225753-aa31f9f1d2f4?w=400&h=300&fit=crop&auto=format',
  });

  const list3 = await createList(userId, 'Activités Weekend', 'Activités cool à faire le weekend', '🎯', '#c47bf7');
  await addPlace(list3.id, {
    name: "Musée d'Orsay",
    notes: 'Collection impressionniste incomparable',
    type: 'Musée', price: 2,
    googleMapsLink: "https://maps.google.com/?q=Musée+d+Orsay+Paris",
    latitude: 48.86, longitude: 2.3266,
    address: "1 Rue de la Légion d'Honneur, 75007 Paris",
    rating: 4.9,
    imageUrl: 'https://images.unsplash.com/photo-1566127444979-b3d2b654e3d7?w=400&h=300&fit=crop&auto=format',
  });

  await addNotification({
    userId, title: 'Bienvenue sur PlaceList ! 👋',
    message: `Bonjour ${username} ! Explorez vos listes, ajoutez des lieux et partagez avec vos amis.`,
    type: 'ai', isRead: false,
  });
  await addNotification({
    userId, title: 'Suggestion IA 🤖',
    message: 'Basé sur vos restaurants parisiens, essayez : Le Grand Véfour et Septime.',
    type: 'ai', isRead: false,
  });
  await addNotification({
    userId, title: 'Sophie a partagé une liste',
    message: 'Sophie vous invite à collaborer sur "Barcelone 2024"',
    type: 'invite', isRead: false,
  });
}

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

export const AI_SUGGESTIONS = {
  default: [
    { name: 'Septime', type: 'Restaurant', reason: 'Similaire à vos choix gastronomiques', rating: 4.8, price: 4, address: '80 Rue de Charonne, 75011 Paris', lat: 48.8527, lng: 2.3789 },
    { name: 'Le Grand Véfour', type: 'Restaurant', reason: 'Restaurant historique parisien', rating: 4.7, price: 4, address: '17 Rue de Beaujolais, 75001 Paris', lat: 48.8636, lng: 2.3375 },
    { name: 'Frenchie', type: 'Restaurant', reason: 'Bistronomie moderne très appréciée', rating: 4.6, price: 3, address: '5 Rue du Nil, 75002 Paris', lat: 48.8635, lng: 2.3488 },
    { name: 'Ten Belles', type: 'Café', reason: 'Meilleur café de spécialité Paris', rating: 4.5, price: 1, address: '10 Rue de la Grange aux Belles, 75010 Paris', lat: 48.8706, lng: 2.3623 },
  ],
};
