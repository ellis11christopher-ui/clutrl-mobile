import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import {
  BrandLockup,
  Pill,
  PrimaryButton,
  SectionLabel,
  commonStyles,
} from '../components/ui';
import { colors, radii } from '../theme';

type Mode = 'guest' | 'master';

export function AuthScreen({ onSkip }: { onSkip: () => void }) {
  const { configured, signInAsGuest, signInWithEmail } = useAuth();
  const [mode, setMode] = useState<Mode>('guest');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  async function submitGuest() {
    setError(null);
    setBusy(true);
    try {
      await signInAsGuest(name);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign in.');
    } finally {
      setBusy(false);
    }
  }

  async function submitMaster() {
    setError(null);
    setBusy(true);
    try {
      await signInWithEmail(email);
      setMagicLinkSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the sign-in link.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={commonStyles.page}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <BrandLockup />

        <View style={styles.intro}>
          <SectionLabel>Sign in</SectionLabel>
          <Text style={styles.title}>Who’s hunting tonight?</Text>
          <Text style={styles.body}>
            Hunters can join with just a name. Hunt Masters sign in with email
            to manage and reuse the same hunts across events.
          </Text>
        </View>

        {!configured ? (
          <View style={styles.noticeCard}>
            <Ionicons name="information-circle-outline" size={18} color={colors.ink} />
            <Text style={styles.noticeText}>
              Supabase isn’t configured for this build (missing
              EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY), so
              sign-in is unavailable. You can still explore the offline demo.
            </Text>
          </View>
        ) : null}

        <View style={styles.modeRow}>
          <ModeTab
            label="Hunter"
            icon="person-outline"
            active={mode === 'guest'}
            onPress={() => {
              setMode('guest');
              setError(null);
            }}
          />
          <ModeTab
            label="Hunt Master"
            icon="ribbon-outline"
            active={mode === 'master'}
            onPress={() => {
              setMode('master');
              setError(null);
            }}
          />
        </View>

        {mode === 'guest' ? (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Display name</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="e.g. Maya"
              placeholderTextColor={colors.muted}
              style={styles.input}
              autoCapitalize="words"
              autoCorrect={false}
              returnKeyType="go"
              editable={configured && !busy}
              onSubmitEditing={submitGuest}
            />
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            <PrimaryButton
              label={busy ? 'Signing in…' : 'Continue as guest'}
              icon={busy ? undefined : 'arrow-forward'}
              variant="lime"
              onPress={submitGuest}
              disabled={!configured || busy}
              style={styles.submitButton}
            />
          </View>
        ) : (
          <View style={styles.card}>
            {magicLinkSent ? (
              <View style={styles.sentState}>
                <Pill tone="lime" icon="mail-outline">
                  LINK SENT
                </Pill>
                <Text style={styles.sentText}>
                  Check {email} for a sign-in link, then return to the app.
                </Text>
              </View>
            ) : (
              <>
                <Text style={styles.cardLabel}>Email</Text>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@example.com"
                  placeholderTextColor={colors.muted}
                  style={styles.input}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  returnKeyType="go"
                  editable={configured && !busy}
                  onSubmitEditing={submitMaster}
                />
                {error ? <Text style={styles.errorText}>{error}</Text> : null}
                <PrimaryButton
                  label={busy ? 'Sending link…' : 'Send sign-in link'}
                  icon={busy ? undefined : 'mail-outline'}
                  variant="dark"
                  onPress={submitMaster}
                  disabled={!configured || busy}
                  style={styles.submitButton}
                />
              </>
            )}
            {busy ? (
              <ActivityIndicator style={styles.spinner} color={colors.ink} />
            ) : null}
          </View>
        )}

        <Pressable onPress={onSkip} style={styles.skipButton}>
          <Text style={styles.skipText}>Continue in offline demo mode</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function ModeTab({
  label,
  icon,
  active,
  onPress,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.modeTab, active && styles.modeTabActive]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      <Ionicons name={icon} size={16} color={active ? colors.ink : colors.muted} />
      <Text style={[styles.modeTabText, active && styles.modeTabTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 40,
  },
  intro: {
    marginTop: 28,
    marginBottom: 22,
  },
  title: {
    marginTop: 10,
    color: colors.ink,
    fontSize: 32,
    lineHeight: 35,
    letterSpacing: -1.2,
    fontWeight: '900',
  },
  body: {
    marginTop: 10,
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
  },
  noticeCard: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: colors.sand,
    borderRadius: radii.md,
    padding: 14,
    marginBottom: 18,
  },
  noticeText: {
    flex: 1,
    color: colors.ink,
    fontSize: 12,
    lineHeight: 18,
  },
  modeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  modeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    minHeight: 46,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
  },
  modeTabActive: {
    backgroundColor: colors.lime,
    borderColor: colors.lime,
  },
  modeTabText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '800',
  },
  modeTabTextActive: {
    color: colors.ink,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 18,
  },
  cardLabel: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: '900',
    marginBottom: 8,
  },
  input: {
    height: 54,
    borderRadius: 16,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 16,
    color: colors.ink,
    fontWeight: '700',
  },
  errorText: {
    color: colors.danger,
    fontSize: 12,
    marginTop: 10,
  },
  submitButton: {
    marginTop: 16,
  },
  spinner: {
    marginTop: 12,
  },
  sentState: {
    alignItems: 'flex-start',
    gap: 10,
  },
  sentText: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
  },
  skipButton: {
    alignSelf: 'center',
    padding: 14,
    marginTop: 18,
  },
  skipText: {
    color: colors.muted,
    fontSize: 12,
    textDecorationLine: 'underline',
  },
});
