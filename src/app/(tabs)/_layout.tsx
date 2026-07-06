import { Tabs } from 'expo-router';
import { Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../../context/ThemeContext';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

// Rend l'icône pleine quand l'onglet est actif, sinon l'icône outline
function icon(name: IoniconName, activeName: IoniconName) {
  return ({ color, focused }: { color: string; focused: boolean }) => (
    <Ionicons name={focused ? activeName : name} size={24} color={color} />
  );
}

// Barre d'onglets principale : Carte / Listes / Alertes / Profil
export default function TabLayout() {
  const { C } = useAppTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: C.card,
          borderTopColor: C.border,
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 84 : 64,
          paddingBottom: Platform.OS === 'ios' ? 28 : 8,
          paddingTop: 8,
        },
        tabBarActiveTintColor: C.primary,
        tabBarInactiveTintColor: C.textMuted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="map"
        options={{
          title: 'Carte',
          tabBarIcon: icon('map-outline', 'map'),
        }}
      />
      <Tabs.Screen
        name="lists"
        options={{
          title: 'Listes',
          tabBarIcon: icon('list-outline', 'list'),
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: 'Alertes',
          tabBarIcon: icon('notifications-outline', 'notifications'),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          tabBarIcon: icon('person-outline', 'person'),
        }}
      />
    </Tabs>
  );
}
