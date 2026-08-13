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
import { BrandLockup, Pill, PrimaryButton, SectionLabel, commonStyles } from '../components/ui';
import { colors, radii } from '../theme';

// The guest-to-account funnel. A guest session is the fastest way into a
// hunt, but it lives and dies with one anonymous token — and a 22-chapter
// Quest can represent weeks of play. This screen upgrades the existing
// account in place (same user id, same progress) rather than starting a new
// one, which is the only version of this flow worth showing a player who has
// something to lose.
export function SaveProgressScreen({
  progress,
  total,
  onDone,
  onDismiss,
}: {
  progress: number;
  total: number;
  onDone: () => void;
  onDismiss: () => void;
}) {
  const { upgradeToEmail } = useAuth();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      await upgradeToEmail(email);
      setSent(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not save your progress.',
      );
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

        {sent ? (
          <View style={styles.intro}>
            <Pill tone="lime" icon="mail-outline">
              CHECK YOUR INBOX
            </Pill>
            <Text style={styles.title}>Almost there.</Text>
            <Text style={styles.body}>
              Tap the link we sent to {email.trim()} to lock this in. Your hunt
              stays exactly where it is — nothing resets, and you can keep
              playing right now while you wait.
            </Text>
            <PrimaryButton
              label="Back to my hunt"
              icon="arrow-forward"
              variant="lime"
              onPress={onDone}
              style={styles.submitButton}
            />
          </View>
        ) : (
          <>
            <View style={styles.intro}>
              <SectionLabel>Guest session</SectionLabel>
              <Text style={styles.title}>Don’t lose your progress.</Text>
              <Text style={styles.body}>
                You’re playing as a guest, which lives only in this app on this
                device. Sign out, switch phones, or clear the app and your
                progress is gone for good.
              </Text>
            </View>

            {total > 0 ? (
              <View style={styles.stakesCard}>
                <View style={styles.stakesIcon}>
                  <Ionicons name="footsteps-outline" size={20} color={colors.ink} />
                </View>
                <Text style={styles.stakesText}>
                  <Text style={styles.stakesCount}>
                    {progress} of {total}
                  </Text>{' '}
                  found so far. Adding an email keeps it — same account, same
                  hunt, nothing restarts.
                </Text>
              </View>
            ) : null}

            <View style={styles.card}>
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
                editable={!busy}
                onSubmitEditing={submit}
              />
              {error ? <Text style={styles.errorText}>{error}</Text> : null}
              <PrimaryButton
                label={busy ? 'Saving…' : 'Save my progress'}
                icon={busy ? undefined : 'shield-checkmark-outline'}
                variant="lime"
                onPress={submit}
                disabled={busy}
                style={styles.submitButton}
              />
              {busy ? (
                <ActivityIndicator style={styles.spinner} color={colors.ink} />
              ) : null}
            </View>

            <Pressable onPress={onDismiss} style={styles.skipButton}>
              <Text style={styles.skipText}>Not now</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
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
    alignItems: 'flex-start',
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
  stakesCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.sand,
    borderRadius: radii.md,
    padding: 14,
    marginBottom: 18,
  },
  stakesIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.lime,
  },
  stakesText: {
    flex: 1,
    color: colors.ink,
    fontSize: 13,
    lineHeight: 19,
  },
  stakesCount: {
    fontWeight: '900',
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
