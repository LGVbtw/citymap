import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { login, register } from '../store';

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

export default function AuthScreen() {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const cardY = useRef(new Animated.Value(60)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(logoScale, { toValue: 1, useNativeDriver: true, tension: 150, friction: 8 }),
      Animated.timing(cardY, { toValue: 0, duration: 500, delay: 200, useNativeDriver: true }),
      Animated.timing(cardOpacity, { toValue: 1, duration: 500, delay: 200, useNativeDriver: true }),
    ]).start();
  }, []);

  async function handleSubmit() {
    setError('');
    setLoading(true);

    if (mode === 'login') {
      const user = await login(username.trim(), password);
      if (!user) {
        setError('Identifiants incorrects');
        setLoading(false);
        return;
      }
    } else {
      if (username.trim().length < 3) {
        setError("Nom d'utilisateur trop court (min. 3 caractères)");
        setLoading(false);
        return;
      }
      if (password.length < 6) {
        setError('Mot de passe trop court (min. 6 caractères)');
        setLoading(false);
        return;
      }
      const user = await register(username.trim(), email.trim(), password);
      if (!user) {
        setError("Nom d'utilisateur déjà pris");
        setLoading(false);
        return;
      }
    }

    router.replace('/map');
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        {/* Header */}
        <View style={styles.header}>
          <Animated.View style={[styles.logo, { transform: [{ scale: logoScale }] }]}>
            <Ionicons name="location" size={32} color="white" />
          </Animated.View>
          <Text style={styles.appName}>PlaceList</Text>
          <Text style={styles.tagline}>Vos lieux favoris, organisés et partagés</Text>
        </View>

        {/* Card */}
        <Animated.View style={[styles.card, { transform: [{ translateY: cardY }], opacity: cardOpacity }]}>
          {/* Mode toggle */}
          <View style={styles.modeTabs}>
            {(['login', 'register'] as const).map(m => (
              <TouchableOpacity
                key={m}
                onPress={() => { setMode(m); setError(''); }}
                style={[styles.modeTab, mode === m && styles.modeTabActive]}
              >
                <Text style={[styles.modeTabText, mode === m && styles.modeTabActiveText]}>
                  {m === 'login' ? 'Connexion' : 'Inscription'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Username */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Nom d'utilisateur</Text>
            <TextInput
              value={username}
              onChangeText={setUsername}
              placeholder="votre_pseudo"
              placeholderTextColor={C.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
            />
          </View>

          {/* Email (register only) */}
          {mode === 'register' && (
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Email</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="vous@email.com"
                placeholderTextColor={C.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
                style={styles.input}
              />
            </View>
          )}

          {/* Password */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Mot de passe</Text>
            <View>
              <TextInput
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPw}
                placeholder="••••••••"
                placeholderTextColor={C.textMuted}
                style={[styles.input, { paddingRight: 44 }]}
              />
              <TouchableOpacity
                onPress={() => setShowPw(v => !v)}
                style={styles.eyeBtn}
              >
                <Ionicons name={showPw ? 'eye-off' : 'eye'} size={18} color={C.textMuted} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Error */}
          {!!error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Submit */}
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={loading}
            style={[styles.submitBtn, loading && { opacity: 0.6 }]}
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.submitText}>
                {mode === 'login' ? 'Se connecter' : 'Créer un compte'}
              </Text>
            )}
          </TouchableOpacity>

          {/* Demo shortcut */}
          {mode === 'login' && (
            <TouchableOpacity
              onPress={() => { setUsername('demo'); setPassword('demo123'); }}
              style={{ alignItems: 'center', marginTop: 14 }}
            >
              <Text style={{ color: C.textMuted, fontSize: 12 }}>
                Utiliser le compte démo →
              </Text>
            </TouchableOpacity>
          )}
        </Animated.View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  header: { alignItems: 'center', paddingTop: 52, paddingBottom: 32 },
  logo: {
    width: 68, height: 68, borderRadius: 18, marginBottom: 16,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: C.primary,
  },
  appName: {
    fontSize: 30, fontWeight: '700', color: C.text, letterSpacing: -0.5,
  },
  tagline: { fontSize: 14, color: C.textMuted, marginTop: 6 },
  card: {
    marginHorizontal: 16, borderRadius: 24, padding: 24,
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
  },
  modeTabs: {
    flexDirection: 'row', backgroundColor: C.muted,
    borderRadius: 12, padding: 4, marginBottom: 24,
  },
  modeTab: { flex: 1, paddingVertical: 9, borderRadius: 9, alignItems: 'center' },
  modeTabActive: { backgroundColor: C.primary },
  modeTabText: { fontSize: 14, color: C.textMuted },
  modeTabActiveText: { color: 'white', fontWeight: '600' },
  field: { marginBottom: 16 },
  fieldLabel: { fontSize: 12, color: C.textMuted, marginBottom: 6 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: C.border,
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 13,
    color: C.text, fontSize: 14,
  },
  eyeBtn: { position: 'absolute', right: 14, top: 0, bottom: 0, justifyContent: 'center' },
  errorBox: {
    backgroundColor: 'rgba(247,95,95,0.1)', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 9, marginBottom: 12,
  },
  errorText: { color: C.destructive, fontSize: 13 },
  submitBtn: {
    paddingVertical: 15, borderRadius: 12, alignItems: 'center',
    backgroundColor: C.primary, marginTop: 8,
  },
  submitText: { color: 'white', fontWeight: '700', fontSize: 16 },
});
