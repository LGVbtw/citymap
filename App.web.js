import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  connecterUtilisateur,
  initializeDatabase,
  inscriptionUtilisateur,
  sauvegarderLieu,
} from './database';
import { fetchPlacesAround } from './overpass';

const DEFAULT_COORDINATES = {
  latitude: 48.852,
  longitude: 2.782,
};

const DEMO_USER = {
  login: 'demo@citymap.local',
  username: 'Demo CityMap',
  mdp: 'demo',
};

const getPlaceType = (place) =>
  place.tags?.amenity ||
  place.tags?.tourism ||
  place.tags?.historic ||
  place.tags?.leisure ||
  place.tags?.shop ||
  'lieu';

const getPlaceCoordinate = (place) => {
  if (Number.isFinite(place.lat) && Number.isFinite(place.lon)) {
    return {
      latitude: place.lat,
      longitude: place.lon,
    };
  }

  if (Number.isFinite(place.center?.lat) && Number.isFinite(place.center?.lon)) {
    return {
      latitude: place.center.lat,
      longitude: place.center.lon,
    };
  }

  const firstGeometryPoint = place.geometry?.find(
    (point) => Number.isFinite(point.lat) && Number.isFinite(point.lon)
  );

  if (firstGeometryPoint) {
    return {
      latitude: firstGeometryPoint.lat,
      longitude: firstGeometryPoint.lon,
    };
  }

  return null;
};

const normalizePlace = (place) => {
  const coordinate = getPlaceCoordinate(place);

  if (!coordinate) {
    return null;
  }

  return {
    ...place,
    coordinate,
    displayName: place.tags?.name || 'Lieu sans nom',
    displayType: getPlaceType(place),
    osmId: String(place.id),
    osmType: place.type || 'node',
  };
};

export default function WebApp() {
  const [currentUser, setCurrentUser] = useState(null);
  const [isDatabaseReady, setIsDatabaseReady] = useState(false);
  const [isLoadingPlaces, setIsLoadingPlaces] = useState(true);
  const [places, setPlaces] = useState([]);
  const [savingPlaceKey, setSavingPlaceKey] = useState(null);

  const isBootstrapping = useMemo(
    () => !isDatabaseReady || isLoadingPlaces,
    [isDatabaseReady, isLoadingPlaces]
  );

  useEffect(() => {
    let isMounted = true;

    const bootstrapDatabase = async () => {
      try {
        await initializeDatabase();

        let user = await connecterUtilisateur(DEMO_USER.login, DEMO_USER.mdp);

        if (!user) {
          await inscriptionUtilisateur(DEMO_USER.login, DEMO_USER.username, DEMO_USER.mdp);
          user = await connecterUtilisateur(DEMO_USER.login, DEMO_USER.mdp);
        }

        if (isMounted) {
          setCurrentUser(user);
          setIsDatabaseReady(true);
        }
      } catch (error) {
        console.error('initializeDatabase:', error);

        if (isMounted) {
          Alert.alert('Erreur SQLite', "Impossible d'initialiser la base locale.");
        }
      }
    };

    bootstrapDatabase();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadPlaces = async () => {
      try {
        const elements = await fetchPlacesAround(
          DEFAULT_COORDINATES.latitude,
          DEFAULT_COORDINATES.longitude
        );
        const normalizedPlaces = elements.map(normalizePlace).filter(Boolean);

        if (isMounted) {
          setPlaces(normalizedPlaces);
        }
      } catch (error) {
        console.error('loadPlaces:', error);

        if (isMounted) {
          Alert.alert('Erreur Overpass', 'Impossible de recuperer les lieux autour de Serris.');
        }
      } finally {
        if (isMounted) {
          setIsLoadingPlaces(false);
        }
      }
    };

    loadPlaces();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleSavePlace = async (place) => {
    if (!currentUser) {
      Alert.alert('Utilisateur indisponible', "La session locale de demo n'est pas prete.");
      return;
    }

    const placeKey = `${place.osmType}-${place.osmId}`;

    try {
      setSavingPlaceKey(placeKey);

      await sauvegarderLieu(currentUser.id, place.osmId, place.osmType, 0, place.displayType);

      Alert.alert('Lieu sauvegarde', `${place.displayName} a ete ajoute en local.`);
    } catch (error) {
      console.error('sauvegarderLieu:', error);
      Alert.alert('Erreur SQLite', "Impossible de sauvegarder ce lieu dans l'appareil.");
    } finally {
      setSavingPlaceKey(null);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>CityMap</Text>
        <Text style={styles.subtitle}>
          Vue web de test. La carte native s'affiche dans Expo Go sur mobile.
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.status}>
          {isBootstrapping ? (
            <>
              <ActivityIndicator color="#111827" size="small" />
              <Text style={styles.statusText}>Chargement...</Text>
            </>
          ) : (
            <Text style={styles.statusText}>{places.length} lieux trouves autour de Serris</Text>
          )}
        </View>

        {places.map((place) => {
          const placeKey = `${place.osmType}-${place.osmId}`;

          return (
            <View key={placeKey} style={styles.placeCard}>
              <View style={styles.placeInfo}>
                <Text style={styles.placeTitle}>{place.displayName}</Text>
                <Text style={styles.placeMeta}>
                  {place.displayType} · {place.coordinate.latitude.toFixed(5)},{' '}
                  {place.coordinate.longitude.toFixed(5)}
                </Text>
              </View>

              <Pressable
                accessibilityRole="button"
                disabled={savingPlaceKey === placeKey}
                onPress={() => handleSavePlace(place)}
                style={({ pressed }) => [
                  styles.saveButton,
                  pressed && styles.saveButtonPressed,
                  savingPlaceKey === placeKey && styles.saveButtonDisabled,
                ]}
              >
                <Text style={styles.saveButtonText}>
                  {savingPlaceKey === placeKey ? 'Sauvegarde...' : 'Sauvegarder'}
                </Text>
              </Pressable>
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#ffffff',
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  title: {
    color: '#111827',
    fontSize: 28,
    fontWeight: '800',
  },
  subtitle: {
    color: '#4b5563',
    fontSize: 14,
    marginTop: 6,
  },
  content: {
    width: '100%',
    maxWidth: 920,
    alignSelf: 'center',
    padding: 24,
    gap: 12,
  },
  status: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  statusText: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '700',
  },
  placeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    padding: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  placeInfo: {
    flex: 1,
    minWidth: 0,
  },
  placeTitle: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '700',
  },
  placeMeta: {
    color: '#4b5563',
    fontSize: 13,
    marginTop: 4,
    textTransform: 'capitalize',
  },
  saveButton: {
    minHeight: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: '#2563eb',
    paddingHorizontal: 14,
  },
  saveButtonPressed: {
    opacity: 0.82,
  },
  saveButtonDisabled: {
    backgroundColor: '#94a3b8',
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
});
