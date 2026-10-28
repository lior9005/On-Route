import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { sha256 } from 'js-sha256';
import { CONFIG } from '../constants/config';

const UNLOCKED_KEY = 'app-unlocked-v1';

/**
 * Asks for the app password before showing the app.
 *
 * This only keeps casual visitors out: the check runs in the app and the
 * code is public. Only the password's SHA-256 hash is stored in code.
 */
export function PasswordGate({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<'checking' | 'locked' | 'unlocked'>('checking');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState(false);

  // Remembered on this device? (stores the hash, so changing the password locks again)
  useEffect(() => {
    AsyncStorage.getItem(UNLOCKED_KEY)
      .then((stored) => setStatus(stored === CONFIG.APP_PASSWORD_SHA256 ? 'unlocked' : 'locked'))
      .catch(() => setStatus('locked'));
  }, []);

  const unlock = async () => {
    if (sha256(password) !== CONFIG.APP_PASSWORD_SHA256) {
      setError(true);
      return;
    }
    if (remember) {
      try {
        await AsyncStorage.setItem(UNLOCKED_KEY, CONFIG.APP_PASSWORD_SHA256);
      } catch {
        // Storage unavailable: unlock for this session only
      }
    }
    setStatus('unlocked');
  };

  if (status === 'unlocked') return <>{children}</>;
  if (status === 'checking') return <View style={styles.container} />;

  return (
    <View style={styles.container}>
      <View style={styles.backgroundCircle} />
      <View style={styles.card}>
        <Text style={styles.icon}>🔒</Text>
        <Text style={styles.title}>On the Way</Text>
        <Text style={styles.subtitle}>Enter the password to continue</Text>

        <TextInput
          style={[styles.input, error && styles.inputError]}
          value={password}
          onChangeText={(text) => {
            setPassword(text);
            setError(false);
          }}
          onSubmitEditing={unlock}
          placeholder="Password"
          placeholderTextColor="#8A96A3"
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus
          returnKeyType="go"
          accessibilityLabel="Password"
        />
        {error && <Text style={styles.errorText}>Wrong password</Text>}

        <TouchableOpacity
          style={styles.checkboxRow}
          onPress={() => setRemember((r) => !r)}
          activeOpacity={0.7}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: remember }}
        >
          <View style={[styles.checkbox, remember && styles.checkboxChecked]}>
            {remember && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <Text style={styles.checkboxLabel}>Remember me on this device</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={unlock} activeOpacity={0.85}>
          <Text style={styles.buttonText}>Unlock</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A1929',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    padding: 20,
  },
  backgroundCircle: {
    position: 'absolute',
    width: 520,
    height: 520,
    borderRadius: 260,
    backgroundColor: '#1E3A5F',
    opacity: 0.6,
    top: -180,
    left: -160,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: 'rgba(255, 255, 255, 0.98)',
    borderRadius: 24,
    padding: 24,
    alignItems: 'stretch',
  },
  icon: {
    fontSize: 36,
    textAlign: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1E3A5F',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7785',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 20,
  },
  input: {
    borderWidth: 2,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    backgroundColor: '#FAFAFA',
    color: '#333',
  },
  inputError: {
    borderColor: '#EF5350',
    backgroundColor: '#FFEBEE',
  },
  errorText: {
    color: '#D32F2F',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 6,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    marginBottom: 18,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#B0BAC5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  checkboxChecked: {
    backgroundColor: '#1976D2',
    borderColor: '#1976D2',
  },
  checkmark: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 16,
  },
  checkboxLabel: {
    fontSize: 14,
    color: '#4A5561',
  },
  button: {
    backgroundColor: '#2196F3',
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
