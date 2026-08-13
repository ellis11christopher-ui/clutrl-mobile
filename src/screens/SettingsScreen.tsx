import { Ionicons } from '@expo/vector-icons';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import {
  BottomNav,
  BrandLockup,
  Pill,
  PrimaryButton,
  SectionLabel,
  commonStyles,
} from '../components/ui';
import { tierCopy } from '../data/demo';
import { colors, radii } from '../theme';
import type { HuntTier, Screen } from '../types';

export function SettingsScreen({
  tier,
  onTierChange,
  onNavigate,
  onReset,
}: {
  tier: HuntTier;
  onTierChange: (tier: HuntTier) => void;
  onNavigate: (screen: Screen) => void;
  onReset: () => void;
}) {
  const tiers: HuntTier[] = ['base', 'live', 'immersive'];
  const { configured, session, profile, signOut } = useAuth();

  async function handleSignOut() {
    try {
      await signOut();
    } catch (err) {
      Alert.alert(
        'Could not sign out',
        err instanceof Error ? err.message : 'Something went wrong.',
      );
    }
  }

  return (
    <View style={commonStyles.page}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <BrandLockup />
        <View style={styles.intro}>
          <SectionLabel>Interactive prototype</SectionLabel>
          <Text style={styles.title}>Choose the experience tier</Text>
          <Text style={styles.body}>
            Switch tiers at any time to test feature access from both the
            hunter and Hunt Master perspectives.
          </Text>
        </View>

        {configured ? (
          <View style={styles.accountCard}>
            <View style={styles.accountIcon}>
              <Ionicons name="person-circle-outline" size={24} color={colors.ink} />
            </View>
            <View style={styles.accountCopy}>
              <Text style={styles.accountTitle}>
                {session
                  ? profile?.display_name ?? session.user.email ?? 'Signed in'
                  : 'Not signed in'}
              </Text>
              <Text style={styles.accountBody}>
                {session
                  ? session.user.is_anonymous
                    ? 'Guest hunter session'
                    : session.user.email
                  : 'Sign in to sync your hunt progress'}
              </Text>
            </View>
            {session ? (
              <Pressable onPress={handleSignOut} style={styles.signOutButton}>
                <Text style={styles.signOutText}>Sign out</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {configured && session?.user.is_anonymous ? (
          <Pressable
            onPress={() => onNavigate('save-progress')}
            style={styles.saveProgressCard}
            accessibilityRole="button"
          >
            <View style={styles.saveProgressIcon}>
              <Ionicons name="shield-checkmark-outline" size={20} color={colors.ink} />
            </View>
            <View style={styles.saveProgressCopy}>
              <Text style={styles.saveProgressTitle}>Save your progress</Text>
              <Text style={styles.saveProgressBody}>
                Guest progress lives only on this device. Add an email to keep it.
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.muted} />
          </Pressable>
        ) : null}

        <View style={styles.tierList}>
          {tiers.map((item, index) => {
            const copy = tierCopy[item];
            const selected = item === tier;
            const icon =
              item === 'base'
                ? 'scan-outline'
                : item === 'live'
                  ? 'navigate-outline'
                  : 'sparkles-outline';
            return (
              <Pressable
                key={item}
                style={[
                  styles.tierCard,
                  selected && styles.tierCardSelected,
                ]}
                onPress={() => onTierChange(item)}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
              >
                <View
                  style={[
                    styles.tierIcon,
                    index === 1 && styles.tierIconLive,
                    index === 2 && styles.tierIconImmersive,
                  ]}
                >
                  <Ionicons
                    name={icon}
                    size={24}
                    color={index === 2 ? colors.white : colors.ink}
                  />
                </View>
                <View style={styles.tierCopy}>
                  <View style={styles.tierTitleRow}>
                    <Text style={styles.tierName}>{copy.name}</Text>
                    {selected ? (
                      <Pill tone="lime" icon="checkmark-circle">
                        ACTIVE
                      </Pill>
                    ) : null}
                  </View>
                  <Text style={styles.tierKicker}>{copy.kicker}</Text>
                  <View style={styles.featureList}>
                    {copy.features.map((feature) => (
                      <View key={feature} style={styles.featureRow}>
                        <Ionicons
                          name="checkmark"
                          size={14}
                          color={colors.success}
                        />
                        <Text style={styles.featureText}>{feature}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.demoNote}>
          <Ionicons name="flask-outline" size={22} color={colors.cyan} />
          <View style={styles.demoNoteCopy}>
            <Text style={styles.demoNoteTitle}>What is real in this build?</Text>
            <Text style={styles.demoNoteBody}>
              Camera QR scanning, foreground GPS, local chat, tier gating, clue
              sequencing, ad sequencing, AR camera overlay, reward completion,
              a printable QR pack, and Supabase sign-in are all implemented.
              Hunt progress itself, sponsor inventory, realtime sync, push
              notifications, and native geo-anchored AR still require
              production services.
            </Text>
          </View>
        </View>

        <PrimaryButton
          label="Reset the hunt demo"
          icon="refresh-outline"
          variant="outline"
          onPress={onReset}
        />

        <Text style={styles.version}>CLUTRL · Prototype 0.1</Text>
      </ScrollView>

      <BottomNav active="settings" onNavigate={onNavigate} />
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 120,
  },
  intro: {
    marginTop: 38,
    marginBottom: 21,
  },
  title: {
    color: colors.ink,
    fontSize: 35,
    lineHeight: 38,
    fontWeight: '900',
    letterSpacing: -1.3,
    marginTop: 5,
  },
  body: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 10,
  },
  accountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    padding: 14,
    marginBottom: 18,
  },
  accountIcon: {
    width: 42,
    height: 42,
    borderRadius: 15,
    backgroundColor: colors.paper,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountCopy: {
    flex: 1,
  },
  accountTitle: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '900',
  },
  accountBody: {
    color: colors.muted,
    fontSize: 11,
    marginTop: 2,
  },
  signOutButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.paper,
  },
  signOutText: {
    color: colors.ink,
    fontSize: 11,
    fontWeight: '800',
  },
  saveProgressCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.sand,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 14,
    marginBottom: 18,
  },
  saveProgressIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.lime,
  },
  saveProgressCopy: {
    flex: 1,
  },
  saveProgressTitle: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '900',
  },
  saveProgressBody: {
    marginTop: 3,
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
  },
  tierList: {
    gap: 10,
  },
  tierCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    padding: 15,
    flexDirection: 'row',
    gap: 13,
  },
  tierCardSelected: {
    borderWidth: 2,
    borderColor: colors.ink,
    padding: 14,
  },
  tierIcon: {
    width: 49,
    height: 49,
    borderRadius: 17,
    backgroundColor: colors.cyan,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tierIconLive: {
    backgroundColor: colors.lime,
  },
  tierIconImmersive: {
    backgroundColor: colors.cyan,
  },
  tierCopy: {
    flex: 1,
  },
  tierTitleRow: {
    minHeight: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tierName: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: '900',
  },
  tierKicker: {
    color: colors.muted,
    fontSize: 11,
    marginTop: 1,
    marginBottom: 9,
  },
  featureList: {
    gap: 4,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  featureText: {
    color: colors.ink,
    fontSize: 10,
    fontWeight: '700',
  },
  demoNote: {
    flexDirection: 'row',
    gap: 11,
    borderRadius: radii.md,
    backgroundColor: '#EDE9FF',
    padding: 15,
    marginVertical: 15,
  },
  demoNoteCopy: {
    flex: 1,
  },
  demoNoteTitle: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: '900',
  },
  demoNoteBody: {
    color: colors.muted,
    fontSize: 10,
    lineHeight: 15,
    marginTop: 4,
  },
  version: {
    color: colors.muted,
    fontSize: 9,
    textAlign: 'center',
    marginTop: 16,
  },
});
