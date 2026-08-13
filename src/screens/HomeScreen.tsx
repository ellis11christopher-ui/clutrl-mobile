import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  BottomNav,
  BrandLockup,
  FormatBadge,
  Pill,
  PrimaryButton,
  ProgressBar,
  SectionLabel,
  TierBadge,
  commonStyles,
} from '../components/ui';
import { colors, radii, shadow } from '../theme';
import type { Hunt, HuntFormat, HuntTier, Screen } from '../types';

export function HomeScreen({
  featuredHunt,
  activeHuntName,
  activeHuntSubtitle,
  tier,
  format,
  joined,
  progress,
  total,
  joinCodeDefault,
  onJoin,
  onScanToJoin,
  onContinue,
  onNavigate,
}: {
  featuredHunt: Hunt;
  activeHuntName: string;
  activeHuntSubtitle?: string;
  tier: HuntTier;
  format?: HuntFormat;
  joined: boolean;
  progress: number;
  total: number;
  joinCodeDefault: string;
  onJoin: (code: string) => Promise<void>;
  onScanToJoin: () => void;
  onContinue: () => void;
  onNavigate: (screen: Screen) => void;
}) {
  const [joinCode, setJoinCode] = useState(joinCodeDefault);
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  async function submitCode() {
    setJoinError(null);
    setJoining(true);
    try {
      await onJoin(joinCode);
    } catch (err) {
      setJoinError(err instanceof Error ? err.message : 'Could not join that hunt.');
    } finally {
      setJoining(false);
    }
  }

  return (
    <View style={commonStyles.page}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={commonStyles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <BrandLockup />
          <Pressable
            style={styles.avatar}
            onPress={() => onNavigate('settings')}
            accessibilityRole="button"
          >
            <Text style={styles.avatarText}>CE</Text>
            <View style={styles.onlineDot} />
          </Pressable>
        </View>

        <View style={styles.intro}>
          <Text style={styles.kicker}>FOLLOW THE CLUES. FIND THE EXPERIENCE.</Text>
          <Text style={styles.headline}>
            The world is{'\n'}your gameboard.
          </Text>
          <Text style={styles.subhead}>
            Camera-first scavenger hunts made for real places, live teams, and
            impossible-to-forget finishes.
          </Text>
        </View>

        {joined ? (
          <ActiveHuntCard
            huntName={activeHuntName}
            subtitle={activeHuntSubtitle}
            progress={progress}
            total={total}
            tier={tier}
            format={format}
            onContinue={onContinue}
            onTracking={() => onNavigate('tracking')}
          />
        ) : (
          <JoinCard
            value={joinCode}
            onChange={setJoinCode}
            onSubmit={submitCode}
            onScanToJoin={onScanToJoin}
            joining={joining}
            error={joinError}
          />
        )}

        <View style={styles.sectionHeader}>
          <View>
            <SectionLabel>Featured hunt</SectionLabel>
            <Text style={styles.sectionTitle}>Tonight in your city</Text>
          </View>
          <Text style={styles.textLink}>View details</Text>
        </View>

        <FeaturedCard hunt={featuredHunt} tier={tier} />

        <View style={styles.statsRow}>
          <Stat icon="camera-outline" value="10" label="discoveries" />
          <Stat icon="walk-outline" value="1.8 mi" label="route" />
          <Stat icon="people-outline" value="24" label="hunting now" />
        </View>
      </ScrollView>

      <BottomNav active="hunt" onNavigate={onNavigate} />
    </View>
  );
}

function JoinCard({
  value,
  onChange,
  onSubmit,
  onScanToJoin,
  joining,
  error,
}: {
  value: string;
  onChange: (text: string) => void;
  onSubmit: () => void;
  onScanToJoin: () => void;
  joining: boolean;
  error: string | null;
}) {
  return (
    <View style={styles.joinCard}>
      <View style={styles.joinIcon}>
        <Ionicons name="keypad-outline" size={21} color={colors.ink} />
      </View>
      <View style={styles.joinCopy}>
        <Text style={styles.joinTitle}>Have a hunt code?</Text>
        <Text style={styles.joinBody}>Enter it, or scan the hunt's join QR.</Text>
      </View>
      <View style={styles.codeRow}>
        <TextInput
          value={value}
          onChangeText={onChange}
          autoCapitalize="characters"
          autoCorrect={false}
          placeholder="ENTER CODE"
          placeholderTextColor={colors.muted}
          style={styles.codeInput}
          returnKeyType="go"
          editable={!joining}
          onSubmitEditing={onSubmit}
        />
        <Pressable
          style={({ pressed }) => [styles.goButton, pressed && styles.pressed]}
          onPress={onSubmit}
          disabled={joining}
          accessibilityRole="button"
        >
          {joining ? (
            <ActivityIndicator size="small" color={colors.ink} />
          ) : (
            <Ionicons name="arrow-forward" size={21} color={colors.ink} />
          )}
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.scanJoinButton, pressed && styles.pressed]}
          onPress={onScanToJoin}
          disabled={joining}
          accessibilityRole="button"
        >
          <Ionicons name="qr-code-outline" size={21} color={colors.ink} />
        </Pressable>
      </View>
      {error ? <Text style={styles.joinError}>{error}</Text> : null}
    </View>
  );
}

function ActiveHuntCard({
  huntName,
  subtitle,
  progress,
  total,
  tier,
  format,
  onContinue,
  onTracking,
}: {
  huntName: string;
  subtitle?: string;
  progress: number;
  total: number;
  tier: HuntTier;
  format?: HuntFormat;
  onContinue: () => void;
  onTracking: () => void;
}) {
  return (
    <View style={styles.activeCard}>
      <View style={styles.activeTop}>
        <Pill tone="lime" icon="radio-button-on">
          HUNT IN PROGRESS
        </Pill>
        <View style={styles.activeBadges}>
          {format ? <FormatBadge format={format} /> : null}
          <TierBadge tier={tier} />
        </View>
      </View>
      <Text style={styles.activeTitle}>{huntName}</Text>
      {subtitle ? <Text style={styles.activeLocation}>{subtitle}</Text> : null}
      <View style={styles.progressCopy}>
        <Text style={styles.progressLabel}>Your progress</Text>
        <Text style={styles.progressValue}>
          {progress}/{total}
        </Text>
      </View>
      <ProgressBar value={progress} total={total} inverse />
      <View style={styles.activeActions}>
        <PrimaryButton
          label={progress === 0 ? 'Reveal clue one' : 'Continue hunt'}
          icon="arrow-forward"
          variant="lime"
          onPress={onContinue}
          style={styles.flexButton}
        />
        {tier !== 'base' ? (
          <Pressable
            style={styles.locationButton}
            onPress={onTracking}
            accessibilityRole="button"
          >
            <Ionicons name="navigate" size={20} color={colors.white} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function FeaturedCard({ hunt, tier }: { hunt: Hunt; tier: HuntTier }) {
  return (
    <View style={styles.featuredCard}>
      <View style={styles.poster}>
        <View style={styles.posterOrbOne} />
        <View style={styles.posterOrbTwo} />
        <View style={styles.posterLineOne} />
        <View style={styles.posterLineTwo} />
        <View style={styles.posterPin}>
          <Ionicons name="sparkles" size={20} color={colors.ink} />
        </View>
        <View style={styles.posterCopy}>
          <Pill tone="dark">LIMITED RUN</Pill>
          <Text style={styles.posterWord}>NEON</Text>
          <Text style={styles.posterWordOutline}>AFTER DARK</Text>
        </View>
      </View>
      <View style={styles.featuredBody}>
        <View style={styles.featuredTop}>
          <View style={styles.featuredTitleWrap}>
            <Text style={styles.featuredTitle}>{hunt.name}</Text>
            <Text style={styles.featuredMeta}>
              {hunt.venue} · {hunt.estimatedMinutes} min
            </Text>
          </View>
          <TierBadge tier={tier} />
        </View>
        <Text style={styles.featuredDescription}>
          Chase forgotten signs, living murals, and a final light hidden in the
          heart of the Arts District.
        </Text>
        <View style={styles.featureList}>
          <Feature icon="scan-outline" label={`${hunt.clues.length} targets`} />
          <Feature icon="gift-outline" label="VIP finish reward" />
          {tier === 'immersive' ? (
            <Feature icon="sparkles-outline" label="2 AR moments" />
          ) : null}
        </View>
      </View>
    </View>
  );
}

function Feature({
  icon,
  label,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
}) {
  return (
    <View style={styles.feature}>
      <Ionicons name={icon} size={15} color={colors.ink} />
      <Text style={styles.featureText}>{label}</Text>
    </View>
  );
}

function Stat({
  icon,
  value,
  label,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  label: string;
}) {
  return (
    <View style={styles.stat}>
      <Ionicons name={icon} size={18} color={colors.cyan} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 42,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 15,
    backgroundColor: colors.sand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 12,
    fontWeight: '900',
    color: colors.ink,
  },
  onlineDot: {
    position: 'absolute',
    right: -1,
    bottom: -1,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.lime,
    borderWidth: 2,
    borderColor: colors.paper,
  },
  intro: {
    marginBottom: 24,
  },
  kicker: {
    color: colors.cyan,
    fontSize: 10,
    letterSpacing: 1.4,
    fontWeight: '900',
    marginBottom: 10,
  },
  headline: {
    color: colors.ink,
    fontSize: 39,
    lineHeight: 41,
    letterSpacing: -1.8,
    fontWeight: '900',
  },
  subhead: {
    marginTop: 14,
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
    maxWidth: 345,
  },
  joinCard: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 18,
    ...shadow,
  },
  joinIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 15,
  },
  joinCopy: {
    marginBottom: 15,
  },
  joinTitle: {
    fontSize: 19,
    fontWeight: '900',
    color: colors.ink,
  },
  joinBody: {
    color: colors.muted,
    fontSize: 13,
    marginTop: 4,
  },
  codeRow: {
    flexDirection: 'row',
    gap: 9,
  },
  codeInput: {
    flex: 1,
    height: 54,
    borderRadius: 16,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 16,
    color: colors.ink,
    fontWeight: '900',
    letterSpacing: 1.4,
  },
  goButton: {
    width: 54,
    height: 54,
    borderRadius: 16,
    backgroundColor: colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanJoinButton: {
    width: 54,
    height: 54,
    borderRadius: 16,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
  joinError: {
    marginTop: 12,
    color: colors.danger,
    fontSize: 12,
    lineHeight: 17,
  },
  activeCard: {
    backgroundColor: colors.ink,
    borderRadius: radii.xl,
    padding: 20,
    ...shadow,
  },
  activeTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 22,
  },
  activeBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  activeTitle: {
    color: colors.white,
    fontSize: 28,
    lineHeight: 31,
    fontWeight: '900',
    letterSpacing: -0.8,
  },
  activeLocation: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 13,
    marginTop: 5,
    marginBottom: 21,
  },
  progressCopy: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  progressLabel: {
    color: 'rgba(255,255,255,0.62)',
    fontSize: 11,
    fontWeight: '700',
  },
  progressValue: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '900',
  },
  activeActions: {
    marginTop: 18,
    flexDirection: 'row',
    gap: 9,
  },
  flexButton: {
    flex: 1,
  },
  locationButton: {
    width: 56,
    height: 56,
    borderRadius: radii.md,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHeader: {
    marginTop: 36,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    marginTop: 3,
    color: colors.ink,
    fontSize: 21,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  textLink: {
    color: colors.cyan,
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 3,
  },
  featuredCard: {
    borderRadius: radii.lg,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: 'hidden',
  },
  poster: {
    height: 215,
    backgroundColor: '#E36C41',
    overflow: 'hidden',
    padding: 18,
    justifyContent: 'flex-end',
  },
  posterOrbOne: {
    position: 'absolute',
    width: 190,
    height: 190,
    borderRadius: 95,
    backgroundColor: colors.cyan,
    right: -44,
    top: -50,
  },
  posterOrbTwo: {
    position: 'absolute',
    width: 126,
    height: 126,
    borderRadius: 63,
    backgroundColor: colors.lime,
    right: 70,
    top: 46,
  },
  posterLineOne: {
    position: 'absolute',
    width: 240,
    height: 3,
    backgroundColor: colors.ink,
    left: -20,
    top: 70,
    transform: [{ rotate: '-15deg' }],
  },
  posterLineTwo: {
    position: 'absolute',
    width: 260,
    height: 3,
    backgroundColor: colors.ink,
    right: -70,
    bottom: 40,
    transform: [{ rotate: '19deg' }],
  },
  posterPin: {
    position: 'absolute',
    right: 52,
    top: 75,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: colors.ink,
  },
  posterCopy: {
    alignItems: 'flex-start',
  },
  posterWord: {
    color: colors.white,
    fontSize: 44,
    lineHeight: 43,
    fontWeight: '900',
    letterSpacing: -2,
    marginTop: 10,
  },
  posterWordOutline: {
    color: colors.ink,
    fontSize: 28,
    lineHeight: 29,
    fontWeight: '900',
    letterSpacing: -1.2,
  },
  featuredBody: {
    padding: 17,
  },
  featuredTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  featuredTitleWrap: {
    flex: 1,
  },
  featuredTitle: {
    color: colors.ink,
    fontSize: 21,
    fontWeight: '900',
  },
  featuredMeta: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 4,
  },
  featuredDescription: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 13,
  },
  featureList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 16,
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    minHeight: 29,
    borderRadius: radii.pill,
    backgroundColor: colors.paper,
  },
  featureText: {
    color: colors.ink,
    fontSize: 10,
    fontWeight: '800',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  stat: {
    flex: 1,
    minHeight: 105,
    backgroundColor: colors.white,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 12,
    justifyContent: 'center',
  },
  statValue: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '900',
    marginTop: 8,
  },
  statLabel: {
    color: colors.muted,
    fontSize: 9,
    marginTop: 2,
  },
});
