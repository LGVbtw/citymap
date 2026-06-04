import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Callout, Marker } from 'react-native-maps';
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

const DEFAULT_REGION = {
  ...DEFAULT_COORDINATES,
  latitudeDelta: 0.04,
  longitudeDelta: 0.04,
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

const getGeometryCenter = (geometry = []) => {
  const points = geometry.filter(
    (point) => Number.isFinite(point.lat) && Number.isFinite(point.lon)
  );

  if (points.length === 0) {
    return null;
  }

  const latitudes = points.map((point) => point.lat);
  const longitudes = points.map((point) => point.lon);

  return {
    latitude: (Math.min(...latitudes) + Math.max(...latitudes)) / 2,
    longitude: (Math.min(...longitudes) + Math.max(...longitudes)) / 2,
  };
};

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

  return getGeometryCenter(place.geometry);
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

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [isDatabaseReady, setIsDatabaseReady] = useState(false);
  const [isLoadingPlaces, setIsLoadingPlaces] = useState(true);
  const [places, setPlaces] = useState([]);
  const [savingPlaceKey, setSavingPlaceKey] = useState(null);

  const isBootstrapping = useMemo(
    () => !isDatabaseReady || isLoadingPlaces,
    [isDatabaseReady, isLoadingPlaces]
  );

  // Initialise SQLite au lancement et prépare un utilisateur local de démo.
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
          setIsDatabaseReady(false);
        }
      }
    };

    bootstrapDatabase();

    return () => {
      isMounted = false;
    };
  }, []);

  // Charge les lieux Overpass au premier affichage de la carte.
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
          Alert.alert('Erreur Overpass', 'Impossible de récupérer les lieux autour de Serris.');
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
      Alert.alert('Utilisateur indisponible', "La session locale de démo n'est pas prête.");
      return;
    }

    const placeKey = `${place.osmType}-${place.osmId}`;

    try {
      setSavingPlaceKey(placeKey);

      await sauvegarderLieu(currentUser.id, place.osmId, place.osmType, 0, place.displayType);

      Alert.alert('Lieu sauvegardé', `${place.displayName} a été ajouté en local.`);
    } catch (error) {
      console.error('sauvegarderLieu:', error);
      Alert.alert('Erreur SQLite', "Impossible de sauvegarder ce lieu dans l'appareil.");
    } finally {
      setSavingPlaceKey(null);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <MapView style={styles.map} initialRegion={DEFAULT_REGION}>
        {places.map((place) => {
          const placeKey = `${place.osmType}-${place.osmId}`;

          return (
            <Marker
              key={placeKey}
              coordinate={place.coordinate}
              title={place.displayName}
              description={place.displayType}
            >
              <Callout
                tooltip={false}
                onPress={savingPlaceKey === placeKey ? undefined : () => handleSavePlace(place)}
              >
                <View style={styles.callout}>
                  <Text style={styles.placeTitle} numberOfLines={2}>
                    {place.displayName}
                  </Text>
                  <Text style={styles.placeType}>{place.displayType}</Text>

                  <View
                    accessibilityRole="button"
                    style={[
                      styles.saveButton,
                      savingPlaceKey === placeKey && styles.saveButtonDisabled,
                    ]}
                  >
                    <Text style={styles.saveButtonText}>
                      {savingPlaceKey === placeKey ? 'Sauvegarde...' : 'Sauvegarder'}
                    </Text>
                  </View>
                </View>
              </Callout>
            </Marker>
          );
        })}
      </MapView>

      <View style={styles.statusPill}>
        {isBootstrapping ? (
          <ActivityIndicator color="#111827" size="small" />
        ) : (
          <Text style={styles.statusText}>{places.length} lieux trouvés</Text>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  map: {
    flex: 1,
  },
  statusPill: {
    position: 'absolute',
    top: 56,
    alignSelf: 'center',
    minHeight: 38,
    minWidth: 132,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 19,
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
  },
  statusText: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '700',
  },
  callout: {
    minWidth: 190,
    maxWidth: 240,
    padding: 12,
  },
  placeTitle: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  placeType: {
    color: '#4b5563',
    fontSize: 13,
    marginBottom: 10,
    textTransform: 'capitalize',
  },
  saveButton: {
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: '#2563eb',
    paddingHorizontal: 12,
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
