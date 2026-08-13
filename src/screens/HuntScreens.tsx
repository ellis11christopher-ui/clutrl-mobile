import { Ionicons } from '@expo/vector-icons';
import { useAudioPlayer } from 'expo-audio';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  IconButton,
  Pill,
  PrimaryButton,
  ProgressBar,
  ScreenTitle,
  SectionLabel,
  TierBadge,
  commonStyles,
} from '../components/ui';
import type { AdStep } from '../domain/huntFlow';
import { colors, radii, shadow } from '../theme';
import type { Clue, HuntTier } from '../types';

function useReducedMotionPreference(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (active) setReduced(enabled);
    });
    return () => {
      active = false;
    };
  }, []);
  return reduced;
}

const CELEBRATION_DURATION_MS = 2000;
const crowdCheerSound = require('../../assets/audio/crowd-cheer.mp3');

// Plays for a fixed 2 seconds after a confirmed scan, before the sponsor ad:
// a real crowd-cheer sound, simulated fireworks, and a couple of haptic
// pulses to sell the moment.
export function CelebrationScreen({ onDone }: { onDone: () => void }) {
  const reduceMotion = useReducedMotionPreference();
  const cheerPlayer = useAudioPlayer(crowdCheerSound);

  useEffect(() => {
    cheerPlayer.seekTo(0);
    cheerPlayer.play();
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const secondPulse = setTimeout(() => {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }, 450);
    const done = setTimeout(onDone, CELEBRATION_DURATION_MS);
    // No manual pause/release here: useAudioPlayer already tears the native
    // player down on unmount, and calling .pause() again in this cleanup
    // races that teardown and crashes ("shared object already released").
    return () => {
      clearTimeout(secondPulse);
      clearTimeout(done);
    };
  }, [onDone, cheerPlayer]);

  const bursts: { left: `${number}%`; top: `${number}%`; delay: number; colors: string[] }[] = [
    { left: '20%', top: '30%', delay: 0, colors: [colors.lime, colors.cyan] },
    { left: '74%', top: '22%', delay: 220, colors: [colors.coral, colors.lime] },
    { left: '50%', top: '46%', delay: 420, colors: [colors.cyan, colors.coral] },
    { left: '28%', top: '62%', delay: 620, colors: [colors.lime, colors.white] },
  ];

  return (
    <View style={styles.celebratePage}>
      {!reduceMotion
        ? bursts.map((burst, index) => <FireworkBurst key={index} {...burst} />)
        : null}
      <View style={styles.celebrateCenter}>
        <View style={styles.celebrateBadge}>
          <Ionicons name="checkmark" size={30} color={colors.ink} />
        </View>
        <Text style={styles.celebrateTitle}>Discovery confirmed</Text>
        <Text style={styles.celebrateBody}>Nice find. The crowd's cheering.</Text>
      </View>
    </View>
  );
}

function FireworkBurst({
  left,
  top,
  delay,
  colors: burstColors,
}: {
  left: `${number}%`;
  top: `${number}%`;
  delay: number;
  colors: string[];
}) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.timing(progress, {
      toValue: 1,
      duration: 950,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [progress, delay]);

  const particleCount = 10;
  const particles = Array.from({ length: particleCount }, (_, i) => {
    const angle = (2 * Math.PI * i) / particleCount;
    const radius = 66 + (i % 3) * 12;
    return {
      dx: Math.cos(angle) * radius,
      dy: Math.sin(angle) * radius,
      color: burstColors[i % burstColors.length]!,
    };
  });

  return (
    <View style={[styles.burstOrigin, { left, top }]} pointerEvents="none">
      {particles.map((particle, index) => (
        <Animated.View
          key={index}
          style={[
            styles.particle,
            {
              backgroundColor: particle.color,
              opacity: progress.interpolate({
                inputRange: [0, 0.12, 0.7, 1],
                outputRange: [0, 1, 1, 0],
              }),
              transform: [
                {
                  translateX: progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, particle.dx],
                  }),
                },
                {
                  translateY: progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, particle.dy],
                  }),
                },
                {
                  scale: progress.interpolate({
                    inputRange: [0, 0.25, 1],
                    outputRange: [0.4, 1, 0.5],
                  }),
                },
              ],
            },
          ]}
        />
      ))}
    </View>
  );
}

const FINALE_DURATION_MS = 15000;
const FINALE_BURST_INTERVAL_MS = 650;
const finishingSongSound = require('../../assets/audio/finishing-song.mp3');

const FINALE_HOTSPOTS: { left: `${number}%`; top: `${number}%` }[] = [
  { left: '18%', top: '26%' },
  { left: '78%', top: '20%' },
  { left: '50%', top: '40%' },
  { left: '30%', top: '58%' },
  { left: '70%', top: '62%' },
  { left: '46%', top: '72%' },
  { left: '14%', top: '46%' },
  { left: '84%', top: '44%' },
];

function buildFinaleBursts(): {
  left: `${number}%`;
  top: `${number}%`;
  delay: number;
  colors: string[];
}[] {
  const colorSets = [
    [colors.lime, colors.cyan],
    [colors.coral, colors.lime],
    [colors.cyan, colors.coral],
    [colors.lime, colors.white],
    [colors.coral, colors.cyan],
  ];
  const count = Math.floor(FINALE_DURATION_MS / FINALE_BURST_INTERVAL_MS);
  return Array.from({ length: count }, (_, i) => ({
    ...FINALE_HOTSPOTS[i % FINALE_HOTSPOTS.length]!,
    delay: i * FINALE_BURST_INTERVAL_MS,
    colors: colorSets[i % colorSets.length]!,
  }));
}

// Plays once, for a full 15 seconds, after the sponsor ad on finishing the
// hunt — right before the reward screen reveals. Same firework mechanic as
// CelebrationScreen, just a much bigger, sustained show with the finishing
// song instead of the per-item crowd cheer.
export function FinaleScreen({ onDone }: { onDone: () => void }) {
  const reduceMotion = useReducedMotionPreference();
  const songPlayer = useAudioPlayer(finishingSongSound);
  const [bursts] = useState(buildFinaleBursts);

  useEffect(() => {
    songPlayer.seekTo(0);
    songPlayer.play();
    const pulseTimers = [0, 3000, 7000, 11000].map((delay) =>
      setTimeout(() => {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }, delay),
    );
    const done = setTimeout(onDone, FINALE_DURATION_MS);
    // Same reasoning as CelebrationScreen: no manual pause here, since
    // useAudioPlayer already releases the native player on unmount.
    return () => {
      pulseTimers.forEach(clearTimeout);
      clearTimeout(done);
    };
  }, [onDone, songPlayer]);

  return (
    <View style={styles.celebratePage}>
      {!reduceMotion
        ? bursts.map((burst, index) => <FireworkBurst key={index} {...burst} />)
        : null}
      <View style={styles.celebrateCenter}>
        <View style={styles.celebrateBadge}>
          <Ionicons name="trophy" size={32} color={colors.ink} />
        </View>
        <Text style={styles.celebrateTitle}>Hunt complete!</Text>
        <Text style={styles.celebrateBody}>Every discovery found. Your reward is next.</Text>
      </View>
    </View>
  );
}

const COUNTDOWN_TICK_MS = 1000;

// A 3-2-1 beat between the sponsor ad and the next clue revealing.
export function CountdownScreen({ onDone }: { onDone: () => void }) {
  const [count, setCount] = useState(3);
  const scale = useRef(new Animated.Value(0.6)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const reduceMotion = useReducedMotionPreference();

  useEffect(() => {
    if (reduceMotion) {
      scale.setValue(1);
      opacity.setValue(1);
      return;
    }
    scale.setValue(0.6);
    opacity.setValue(0);
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 5 }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, [count, reduceMotion, scale, opacity]);

  useEffect(() => {
    if (count <= 1) {
      const finish = setTimeout(onDone, COUNTDOWN_TICK_MS);
      return () => clearTimeout(finish);
    }
    const next = setTimeout(() => setCount((c) => c - 1), COUNTDOWN_TICK_MS);
    return () => clearTimeout(next);
  }, [count, onDone]);

  return (
    <View style={styles.countdownPage}>
      <Text style={styles.countdownLabel}>Next discovery in</Text>
      <Animated.Text
        style={[styles.countdownNumber, { transform: [{ scale }], opacity }]}
      >
        {count}
      </Animated.Text>
    </View>
  );
}

export function AdScreen({
  step,
  remaining,
  onContinue,
}: {
  step: AdStep;
  remaining: number;
  onContinue: () => void;
}) {
  return (
    <View style={styles.adPage}>
      <View style={styles.adHeader}>
        <View>
          <SectionLabel>{step.label}</SectionLabel>
          <Text style={styles.adHeaderMeta}>Demo sponsor placement</Text>
        </View>
        <Pill tone="light">AD</Pill>
      </View>

      <LinearGradient colors={step.placement.colors} style={styles.adCreative}>
        <View style={styles.adTextureOne} />
        <View style={styles.adTextureTwo} />
        <View style={styles.adBrandRow}>
          <View style={styles.adLogo}>
            <Ionicons name="flash" size={19} color={colors.white} />
          </View>
          <Text style={styles.adBrand}>{step.placement.brand}</Text>
        </View>
        <View style={styles.adCopy}>
          <Text style={styles.adHeadline}>{step.placement.headline}</Text>
          <Text style={styles.adDetail}>{step.placement.detail}</Text>
        </View>
        <View style={styles.adCta}>
          <Text style={styles.adCtaText}>{step.placement.cta}</Text>
          <Ionicons name="arrow-forward" size={17} color={colors.white} />
        </View>
      </LinearGradient>

      <View style={styles.adFooter}>
        <View style={styles.adDots}>
          {Array.from({ length: Math.max(remaining, 1) }).map((_, index) => (
            <View
              key={index}
              style={[styles.adDot, index === 0 && styles.adDotActive]}
            />
          ))}
        </View>
        <Text style={styles.adDisclosure}>
          Production builds use timed, policy-compliant placements. This button
          is immediate for prototype testing.
        </Text>
        <PrimaryButton
          label={remaining > 1 ? 'Continue to next message' : 'Continue'}
          icon="arrow-forward"
          onPress={onContinue}
        />
      </View>
    </View>
  );
}

export function ClueScreen({
  clue,
  tier,
  total,
  completed,
  onBack,
  onScan,
  onAr,
  onChat,
}: {
  clue: Clue;
  tier: HuntTier;
  total: number;
  completed: number;
  onBack: () => void;
  onScan: () => void;
  onAr: () => void;
  onChat: () => void;
}) {
  const [hintOpen, setHintOpen] = useState(false);
  const isAr = clue.kind === 'ar';
  const canUseAr = tier === 'immersive';

  useEffect(() => setHintOpen(false), [clue.id]);

  return (
    <View style={commonStyles.page}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.clueContent}
      >
        <ScreenTitle
          eyebrow={`Discovery ${clue.order} of ${total}`}
          title={clue.title}
          onBack={onBack}
          action={<TierBadge tier={tier} />}
        />

        <View style={styles.progressBlock}>
          <View style={styles.progressLine}>
            <Text style={styles.clueProgressText}>Hunt progress</Text>
            <Text style={styles.clueProgressValue}>
              {completed}/{total} found
            </Text>
          </View>
          <ProgressBar value={completed} total={total} />
        </View>

        <ClueMedia clue={clue} />

        <View style={styles.clueCard}>
          <Pill
            tone={
              clue.kind === 'ar'
                ? 'cyan'
                : clue.kind === 'video'
                  ? 'coral'
                  : 'lime'
            }
            icon={
              clue.kind === 'text'
                ? 'text-outline'
                : clue.kind === 'photo'
                  ? 'image-outline'
                  : clue.kind === 'video'
                    ? 'play-outline'
                    : 'sparkles'
            }
          >
            {clue.eyebrow.toUpperCase()}
          </Pill>
          <Text style={styles.clueQuote}>{clue.clue}</Text>
          <Pressable
            style={styles.hintRow}
            onPress={() => setHintOpen((open) => !open)}
          >
            <View style={styles.hintIcon}>
              <Ionicons name="bulb-outline" size={18} color={colors.ink} />
            </View>
            <View style={styles.hintCopy}>
              <Text style={styles.hintTitle}>
                {hintOpen ? 'Here’s your hint' : 'Need a little nudge?'}
              </Text>
              <Text style={styles.hintBody}>
                {hintOpen ? clue.hint : 'Tap to reveal one hint'}
              </Text>
            </View>
            <Ionicons
              name={hintOpen ? 'chevron-up' : 'chevron-down'}
              size={18}
              color={colors.muted}
            />
          </Pressable>
        </View>

        {isAr ? (
          <View style={styles.arPrompt}>
            <View style={styles.arPromptIcon}>
              <Ionicons name="sparkles" size={22} color={colors.white} />
            </View>
            <View style={styles.arPromptCopy}>
              <Text style={styles.arPromptTitle}>This clue comes alive</Text>
              <Text style={styles.arPromptBody}>
                {canUseAr
                  ? 'Open your camera to reveal the geolocated moment.'
                  : 'Immersive tier is required for camera AR.'}
              </Text>
            </View>
            <Pressable
              onPress={onAr}
              style={({ pressed }) => [
                styles.arPromptButton,
                pressed && styles.buttonPressed,
              ]}
            >
              <Ionicons
                name={canUseAr ? 'camera' : 'lock-closed'}
                size={18}
                color={colors.ink}
              />
            </Pressable>
          </View>
        ) : null}

        {tier !== 'base' ? (
          <Pressable style={styles.masterHelp} onPress={onChat}>
            <View style={styles.masterAvatar}>
              <Text style={styles.masterAvatarText}>HM</Text>
            </View>
            <View style={styles.masterHelpCopy}>
              <Text style={styles.masterHelpTitle}>Ask the Hunt Master</Text>
              <Text style={styles.masterHelpBody}>Usually replies in under a minute</Text>
            </View>
            <Ionicons name="chatbubble-outline" size={19} color={colors.ink} />
          </Pressable>
        ) : null}
      </ScrollView>

      <View style={styles.clueFooter}>
        <PrimaryButton
          label="Scan the target QR"
          icon="scan"
          variant="dark"
          onPress={onScan}
        />
      </View>
    </View>
  );
}

function ClueMedia({ clue }: { clue: Clue }) {
  if (clue.kind === 'text') {
    return (
      <View style={[styles.mediaFrame, styles.textMedia]}>
        <View style={styles.textMediaRingOne} />
        <View style={styles.textMediaRingTwo} />
        <View style={styles.textMediaPin}>
          <Ionicons name="location" size={31} color={colors.ink} />
        </View>
        <Text style={styles.textMediaNumber}>
          {String(clue.order).padStart(2, '0')}
        </Text>
      </View>
    );
  }

  if (clue.kind === 'photo') {
    return (
      <View style={[styles.mediaFrame, styles.photoMedia]}>
        <View style={styles.photoSun} />
        <View style={styles.photoBuildingLeft} />
        <View style={styles.photoBuildingRight} />
        <View style={styles.photoSign}>
          <Text style={styles.photoSignText}>{clue.visualLabel}</Text>
        </View>
        <View style={styles.mediaCaption}>
          <Ionicons name="image-outline" size={15} color={colors.white} />
          <Text style={styles.mediaCaptionText}>REFERENCE PHOTO</Text>
        </View>
      </View>
    );
  }

  if (clue.kind === 'video') {
    return (
      <View style={[styles.mediaFrame, styles.videoMedia]}>
        <View style={styles.videoBarOne} />
        <View style={styles.videoBarTwo} />
        <View style={styles.videoPlay}>
          <Ionicons name="play" size={28} color={colors.ink} />
        </View>
        <Text style={styles.videoLabel}>{clue.visualLabel}</Text>
        <View style={styles.videoDuration}>
          <Text style={styles.videoDurationText}>{clue.videoDuration}</Text>
        </View>
      </View>
    );
  }

  return (
    <LinearGradient
      colors={['#151612', '#0B7FA6', '#00D7FF']}
      style={[styles.mediaFrame, styles.arMedia]}
    >
      <View style={styles.arGridHorizontal} />
      <View style={styles.arGridVertical} />
      <View style={styles.arGlow}>
        <Ionicons name="sparkles" size={42} color={colors.white} />
      </View>
      <Text style={styles.arMediaLabel}>{clue.visualLabel}</Text>
      <Text style={styles.arMediaMeta}>GEOLOCKED · CAMERA READY</Text>
    </LinearGradient>
  );
}

export function ScannerScreen({
  clue,
  total,
  demoScanValue,
  onBack,
  onScan,
}: {
  clue: Clue;
  total: number;
  demoScanValue?: string;
  onBack: () => void;
  onScan: (rawValue: string) => Promise<void>;
}) {
  const [permission, requestPermission] = useCameraPermissions();
  const [locked, setLocked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manualValue, setManualValue] = useState('');

  async function handleScan(rawValue: string) {
    if (locked || submitting) return;
    setSubmitting(true);
    try {
      await onScan(rawValue);
      setLocked(true);
      setError(null);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'That belongs to a different discovery. Keep looking.',
      );
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSubmitting(false);
    }
  }

  function handleBarcode(result: BarcodeScanningResult) {
    void handleScan(result.data);
  }

  function submitManualCode() {
    if (!manualValue.trim()) return;
    void handleScan(manualValue.trim());
  }

  if (!permission) {
    return (
      <View style={styles.permissionPage}>
        <Text style={styles.permissionTitle}>Opening the camera…</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionPage}>
        <View style={styles.permissionIcon}>
          <Ionicons name="camera-outline" size={32} color={colors.ink} />
        </View>
        <Text style={styles.permissionTitle}>Camera access is essential</Text>
        <Text style={styles.permissionBody}>
          CLUTRL verifies each discovery by scanning its printed QR marker.
        </Text>
        {error ? <Text style={styles.permissionError}>{error}</Text> : null}
        <PrimaryButton
          label="Allow camera access"
          icon="camera"
          variant="lime"
          onPress={requestPermission}
          style={styles.permissionButton}
        />
        <PrimaryButton
          label="Go back"
          variant="outline"
          onPress={onBack}
          style={styles.permissionButton}
        />
        <Text style={styles.permissionDivider}>
          Camera unavailable or denied? Type the code instead.
        </Text>
        <View style={styles.manualRow}>
          <TextInput
            value={manualValue}
            onChangeText={setManualValue}
            placeholder="Enter the code"
            placeholderTextColor="rgba(255,255,255,0.5)"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!submitting}
            style={styles.manualInput}
            returnKeyType="go"
            onSubmitEditing={submitManualCode}
          />
          <Pressable
            style={({ pressed }) => [
              styles.manualSubmit,
              pressed && styles.buttonPressed,
            ]}
            onPress={submitManualCode}
            disabled={submitting}
            accessibilityRole="button"
          >
            {submitting ? (
              <ActivityIndicator size="small" color={colors.ink} />
            ) : (
              <Ionicons name="arrow-forward" size={18} color={colors.ink} />
            )}
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.cameraPage}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={locked || submitting ? undefined : handleBarcode}
      />
      <View style={styles.cameraShadeTop} />
      <View style={styles.cameraHeader}>
        <IconButton icon="close" onPress={onBack} inverse />
        <View style={styles.cameraTitleWrap}>
          <Text style={styles.cameraTitle}>Scan discovery {clue.order}</Text>
          <Text style={styles.cameraSubtitle}>Align the QR code in the frame</Text>
        </View>
        <View style={styles.cameraCounter}>
          <Text style={styles.cameraCounterText}>
            {clue.order}/{total}
          </Text>
        </View>
      </View>

      <View style={styles.scanArea}>
        <View style={styles.scanFrame}>
          <View style={[styles.scanCorner, styles.scanCornerTL]} />
          <View style={[styles.scanCorner, styles.scanCornerTR]} />
          <View style={[styles.scanCorner, styles.scanCornerBL]} />
          <View style={[styles.scanCorner, styles.scanCornerBR]} />
          <View style={styles.scanLine} />
        </View>
        {submitting ? (
          <View style={styles.scanBusy}>
            <ActivityIndicator color={colors.white} />
          </View>
        ) : null}
        {error ? (
          <View style={styles.scanError}>
            <Ionicons name="alert-circle" size={18} color={colors.white} />
            <Text style={styles.scanErrorText}>{error}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.cameraFooter}>
        <View style={styles.flashHint}>
          <Ionicons name="sunny-outline" size={18} color={colors.white} />
          <Text style={styles.flashHintText}>Good light makes scanning faster</Text>
        </View>
        {demoScanValue ? (
          <PrimaryButton
            label="Use the demo QR"
            icon="flask-outline"
            variant="lime"
            onPress={() => void handleScan(demoScanValue)}
            disabled={submitting}
            style={styles.manualSubmitSpacing}
          />
        ) : null}
        <View style={styles.manualRow}>
          <TextInput
            value={manualValue}
            onChangeText={setManualValue}
            placeholder="Can't scan? Type the code"
            placeholderTextColor="rgba(255,255,255,0.5)"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!submitting}
            style={styles.manualInput}
            returnKeyType="go"
            onSubmitEditing={submitManualCode}
          />
          <Pressable
            style={({ pressed }) => [
              styles.manualSubmit,
              pressed && styles.buttonPressed,
            ]}
            onPress={submitManualCode}
            disabled={submitting}
            accessibilityRole="button"
          >
            <Ionicons name="arrow-forward" size={18} color={colors.ink} />
          </Pressable>
        </View>
        {demoScanValue ? (
          <Text style={styles.demoCode}>
            Test value: {clue.id} · real QR included in the print pack
          </Text>
        ) : null}
      </View>
    </View>
  );
}

export function ArScreen({
  clue,
  tier,
  onBack,
  onReadyToScan,
}: {
  clue: Clue;
  tier: HuntTier;
  onBack: () => void;
  onReadyToScan: () => void;
}) {
  const [permission, requestPermission] = useCameraPermissions();
  const camera = useRef<CameraView>(null);
  const [capturedUri, setCapturedUri] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [pulse]);

  async function capture() {
    if (!camera.current || capturing) return;
    setCapturing(true);
    try {
      const photo = await camera.current.takePictureAsync({ quality: 0.82 });
      if (photo?.uri) {
        setCapturedUri(photo.uri);
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } finally {
      setCapturing(false);
    }
  }

  if (tier !== 'immersive') {
    return (
      <View style={styles.arLockedPage}>
        <IconButton icon="arrow-back" onPress={onBack} inverse />
        <View style={styles.arLockedCenter}>
          <View style={styles.arLockedIcon}>
            <Ionicons name="lock-closed" size={28} color={colors.ink} />
          </View>
          <Text style={styles.arLockedTitle}>Unlock the hidden layer</Text>
          <Text style={styles.arLockedBody}>
            Geolocated camera animations and AR photo captures are available on
            Immersive hunts.
          </Text>
          <TierBadge tier="immersive" />
        </View>
      </View>
    );
  }

  if (!permission?.granted) {
    return (
      <View style={styles.arLockedPage}>
        <IconButton icon="arrow-back" onPress={onBack} inverse />
        <View style={styles.arLockedCenter}>
          <View style={styles.arLockedIcon}>
            <Ionicons name="sparkles" size={28} color={colors.ink} />
          </View>
          <Text style={styles.arLockedTitle}>Reveal the AR moment</Text>
          <Text style={styles.arLockedBody}>
            Camera access lets CLUTRL place the discovery in your live view.
          </Text>
          <PrimaryButton
            label="Allow camera access"
            icon="camera"
            variant="lime"
            onPress={requestPermission}
            style={styles.arPermissionButton}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.cameraPage}>
      {capturedUri ? (
        <Image
          source={{ uri: capturedUri }}
          resizeMode="cover"
          style={StyleSheet.absoluteFill}
        />
      ) : (
        <CameraView ref={camera} style={StyleSheet.absoluteFill} facing="back" />
      )}
      <LinearGradient
        colors={['rgba(22,23,19,0.72)', 'transparent', 'rgba(22,23,19,0.76)']}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.cameraHeader}>
        <IconButton
          icon={capturedUri ? 'close' : 'arrow-back'}
          onPress={capturedUri ? () => setCapturedUri(null) : onBack}
          inverse
        />
        <View style={styles.cameraTitleWrap}>
          <Text style={styles.cameraTitle}>
            {capturedUri ? 'Moment captured' : clue.title}
          </Text>
          <Text style={styles.cameraSubtitle}>
            {capturedUri ? 'AR proof-of-concept preview' : 'Move slowly · face west'}
          </Text>
        </View>
        <Pill tone="cyan" icon="sparkles">
          AR
        </Pill>
      </View>

      <View style={styles.arStage}>
        <View style={styles.arDistance}>
          <Ionicons name="navigate" size={14} color={colors.white} />
          <Text style={styles.arDistanceText}>Target locked · 8m</Text>
        </View>
        <Animated.View
          style={[
            styles.arCreatureGlow,
            {
              transform: [
                {
                  translateY: pulse.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-7, 7],
                  }),
                },
                {
                  scale: pulse.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.96, 1.05],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={styles.arCreature}>
            <View style={styles.foxEarLeft} />
            <View style={styles.foxEarRight} />
            <View style={styles.foxFace}>
              <View style={styles.foxEye} />
              <View style={[styles.foxEye, styles.foxEyeRight]} />
              <View style={styles.foxNose} />
            </View>
          </View>
          <Text style={styles.arObjectLabel}>DESERT FOX</Text>
        </Animated.View>
      </View>

      <View style={styles.arFooter}>
        {capturedUri ? (
          <>
            <PrimaryButton
              label="Continue to QR target"
              icon="scan"
              variant="lime"
              onPress={onReadyToScan}
            />
            <Text style={styles.arFootnote}>
              Production builds composite the AR layer into the saved photo.
            </Text>
          </>
        ) : (
          <>
            <Text style={styles.arInstruction}>
              Center the fox, then capture your team’s AR moment.
            </Text>
            <Pressable
              style={({ pressed }) => [
                styles.shutterOuter,
                pressed && styles.buttonPressed,
              ]}
              onPress={capture}
              disabled={capturing}
            >
              <View style={styles.shutterInner} />
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

export function RewardScreen({
  huntName,
  rewardTitle,
  rewardCopy,
  rewardCode,
  totalItems,
  onHome,
  onRestart,
}: {
  huntName: string;
  rewardTitle: string;
  rewardCopy: string;
  rewardCode: string;
  totalItems: number;
  onHome: () => void;
  onRestart: () => void;
}) {
  return (
    <View style={styles.rewardPage}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.rewardContent}
      >
        <View style={styles.confettiField}>
          <View style={[styles.confetti, styles.confettiOne]} />
          <View style={[styles.confetti, styles.confettiTwo]} />
          <View style={[styles.confetti, styles.confettiThree]} />
          <View style={[styles.confetti, styles.confettiFour]} />
          <View style={styles.rewardMedal}>
            <Ionicons name="trophy" size={42} color={colors.ink} />
          </View>
        </View>
        <SectionLabel>
          Hunt complete · {totalItems} of {totalItems}
        </SectionLabel>
        <Text style={styles.rewardTitle}>{rewardTitle}</Text>
        <Text style={styles.rewardSubtitle}>
          You found every discovery in {huntName}. Your reward is ready.
        </Text>

        <View style={styles.ticket}>
          <View style={styles.ticketTop}>
            <Pill tone="lime" icon="gift-outline">
              FINISH REWARD
            </Pill>
            <Text style={styles.ticketTitle}>{rewardTitle}</Text>
            <Text style={styles.ticketBody}>{rewardCopy}</Text>
          </View>
          <View style={styles.ticketTear}>
            <View style={styles.ticketNotchLeft} />
            <View style={styles.ticketDash} />
            <View style={styles.ticketNotchRight} />
          </View>
          {rewardCode ? (
            <View style={styles.ticketBottom}>
              <Text style={styles.rewardCodeLabel}>REDEMPTION CODE</Text>
              <Text selectable style={styles.rewardCode}>
                {rewardCode}
              </Text>
              <Text style={styles.rewardExpiry}>Valid tonight only · Single use</Text>
            </View>
          ) : (
            <View style={styles.ticketBottom}>
              <Text style={styles.rewardExpiry}>
                No redemption code to show here. Codes are shown once, when
                you finish — ask your Hunt Master if you need it again.
              </Text>
            </View>
          )}
        </View>

        <View style={styles.rewardStats}>
          <RewardStat value={String(totalItems)} label="found" />
          <RewardStat value="68m" label="time" />
          <RewardStat value="1.8" label="miles" />
        </View>

        <PrimaryButton
          label="Share the finish"
          icon="share-outline"
          variant="lime"
          onPress={() =>
            Alert.alert('Share card ready', 'Native sharing is connected in the production build.')
          }
        />
        <PrimaryButton
          label="Back to home"
          variant="outline"
          onPress={onHome}
          style={styles.rewardSecondary}
        />
        <Pressable onPress={onRestart} style={styles.restartButton}>
          <Text style={styles.restartText}>Reset prototype</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function RewardStat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.rewardStat}>
      <Text style={styles.rewardStatValue}>{value}</Text>
      <Text style={styles.rewardStatLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  buttonPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.98 }],
  },
  celebratePage: {
    flex: 1,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  celebrateCenter: {
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  celebrateBadge: {
    width: 68,
    height: 68,
    borderRadius: 24,
    backgroundColor: colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  celebrateTitle: {
    color: colors.white,
    fontSize: 26,
    lineHeight: 30,
    fontWeight: '900',
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  celebrateBody: {
    color: 'rgba(255,255,255,0.62)',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  burstOrigin: {
    position: 'absolute',
    width: 0,
    height: 0,
  },
  particle: {
    position: 'absolute',
    width: 9,
    height: 9,
    borderRadius: 4.5,
    left: -4.5,
    top: -4.5,
  },
  countdownPage: {
    flex: 1,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countdownLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  countdownNumber: {
    color: colors.lime,
    fontSize: 96,
    lineHeight: 100,
    fontWeight: '900',
  },
  adPage: {
    flex: 1,
    backgroundColor: colors.paper,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 18,
  },
  adHeader: {
    minHeight: 60,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  adHeaderMeta: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 4,
  },
  adCreative: {
    flex: 1,
    minHeight: 390,
    maxHeight: 560,
    borderRadius: radii.xl,
    padding: 24,
    overflow: 'hidden',
    justifyContent: 'space-between',
    ...shadow,
  },
  adTextureOne: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(255,255,255,0.28)',
    right: -90,
    top: 45,
  },
  adTextureTwo: {
    position: 'absolute',
    width: 190,
    height: 190,
    borderRadius: 95,
    borderWidth: 34,
    borderColor: 'rgba(22,23,19,0.10)',
    left: -80,
    bottom: 60,
  },
  adBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  adLogo: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adBrand: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 1,
  },
  adCopy: {
    zIndex: 2,
  },
  adHeadline: {
    color: colors.ink,
    fontSize: 48,
    lineHeight: 48,
    letterSpacing: -2.2,
    fontWeight: '900',
    maxWidth: 310,
  },
  adDetail: {
    color: 'rgba(22,23,19,0.70)',
    fontSize: 15,
    lineHeight: 22,
    marginTop: 16,
    maxWidth: 290,
    fontWeight: '600',
  },
  adCta: {
    alignSelf: 'flex-start',
    minHeight: 48,
    paddingHorizontal: 17,
    borderRadius: radii.pill,
    backgroundColor: colors.ink,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  adCtaText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '900',
  },
  adFooter: {
    paddingTop: 17,
  },
  adDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 5,
    marginBottom: 10,
  },
  adDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.line,
  },
  adDotActive: {
    width: 18,
    backgroundColor: colors.ink,
  },
  adDisclosure: {
    color: colors.muted,
    fontSize: 10,
    lineHeight: 14,
    textAlign: 'center',
    marginHorizontal: 12,
    marginBottom: 13,
  },
  clueContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 120,
  },
  progressBlock: {
    marginTop: 20,
    marginBottom: 18,
  },
  progressLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  clueProgressText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
  },
  clueProgressValue: {
    color: colors.ink,
    fontSize: 11,
    fontWeight: '900',
  },
  mediaFrame: {
    height: 240,
    borderRadius: radii.lg,
    overflow: 'hidden',
    marginBottom: 14,
  },
  textMedia: {
    backgroundColor: colors.cyan,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textMediaRingOne: {
    position: 'absolute',
    width: 210,
    height: 210,
    borderRadius: 105,
    borderWidth: 38,
    borderColor: 'rgba(255,255,255,0.38)',
  },
  textMediaRingTwo: {
    position: 'absolute',
    width: 340,
    height: 340,
    borderRadius: 170,
    borderWidth: 2,
    borderColor: 'rgba(22,23,19,0.18)',
  },
  textMediaPin: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.lime,
    borderWidth: 4,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-8deg' }],
  },
  textMediaNumber: {
    position: 'absolute',
    right: 18,
    bottom: 9,
    color: 'rgba(22,23,19,0.18)',
    fontSize: 70,
    fontWeight: '900',
  },
  photoMedia: {
    backgroundColor: '#F5A168',
  },
  photoSun: {
    position: 'absolute',
    width: 115,
    height: 115,
    borderRadius: 58,
    backgroundColor: colors.lime,
    right: 32,
    top: 28,
  },
  photoBuildingLeft: {
    position: 'absolute',
    width: 150,
    height: 145,
    backgroundColor: colors.cyan,
    left: -10,
    bottom: -20,
    transform: [{ rotate: '-4deg' }],
  },
  photoBuildingRight: {
    position: 'absolute',
    width: 190,
    height: 110,
    backgroundColor: colors.ink,
    right: -15,
    bottom: -10,
    transform: [{ rotate: '3deg' }],
  },
  photoSign: {
    position: 'absolute',
    left: 54,
    right: 45,
    top: 87,
    minHeight: 55,
    borderRadius: 7,
    backgroundColor: colors.coral,
    borderWidth: 4,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-4deg' }],
  },
  photoSignText: {
    color: colors.white,
    fontSize: 14,
    letterSpacing: 1.3,
    fontWeight: '900',
  },
  mediaCaption: {
    position: 'absolute',
    left: 12,
    bottom: 12,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(22,23,19,0.84)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    minHeight: 28,
  },
  mediaCaptionText: {
    color: colors.white,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  videoMedia: {
    backgroundColor: colors.cyan,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoBarOne: {
    position: 'absolute',
    width: 440,
    height: 52,
    backgroundColor: colors.lime,
    transform: [{ rotate: '-22deg' }],
  },
  videoBarTwo: {
    position: 'absolute',
    width: 440,
    height: 36,
    backgroundColor: colors.coral,
    transform: [{ rotate: '28deg' }],
  },
  videoPlay: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.white,
    borderWidth: 4,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 4,
    zIndex: 2,
  },
  videoLabel: {
    color: colors.white,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
    marginTop: 14,
    zIndex: 2,
  },
  videoDuration: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    backgroundColor: 'rgba(22,23,19,0.86)',
    borderRadius: 7,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  videoDurationText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: '900',
  },
  arMedia: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  arGridHorizontal: {
    position: 'absolute',
    width: '130%',
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  arGridVertical: {
    position: 'absolute',
    height: '130%',
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  arGlow: {
    width: 105,
    height: 105,
    borderRadius: 53,
    backgroundColor: 'rgba(200,255,0,0.20)',
    borderWidth: 1,
    borderColor: colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.lime,
    shadowOpacity: 0.8,
    shadowRadius: 25,
  },
  arMediaLabel: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1.4,
    marginTop: 15,
  },
  arMediaMeta: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.9,
    marginTop: 5,
  },
  clueCard: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 18,
  },
  clueQuote: {
    color: colors.ink,
    fontSize: 22,
    lineHeight: 29,
    fontWeight: '800',
    letterSpacing: -0.45,
    marginTop: 17,
    marginBottom: 19,
  },
  hintRow: {
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  hintIcon: {
    width: 37,
    height: 37,
    borderRadius: 13,
    backgroundColor: colors.paper,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hintCopy: {
    flex: 1,
  },
  hintTitle: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: '900',
  },
  hintBody: {
    color: colors.muted,
    fontSize: 11,
    marginTop: 2,
  },
  arPrompt: {
    backgroundColor: colors.ink,
    borderRadius: radii.md,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    marginTop: 12,
  },
  arPromptIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: colors.cyan,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arPromptCopy: {
    flex: 1,
  },
  arPromptTitle: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '900',
  },
  arPromptBody: {
    color: 'rgba(255,255,255,0.58)',
    fontSize: 10,
    lineHeight: 14,
    marginTop: 2,
  },
  arPromptButton: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
  },
  masterHelp: {
    borderRadius: radii.md,
    backgroundColor: colors.sand,
    padding: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    marginTop: 12,
  },
  masterAvatar: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: colors.cyan,
    alignItems: 'center',
    justifyContent: 'center',
  },
  masterAvatarText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '900',
  },
  masterHelpCopy: {
    flex: 1,
  },
  masterHelpTitle: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: '900',
  },
  masterHelpBody: {
    color: colors.muted,
    fontSize: 10,
    marginTop: 2,
  },
  clueFooter: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 13,
    backgroundColor: 'rgba(245,241,232,0.96)',
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  permissionPage: {
    flex: 1,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  permissionIcon: {
    width: 68,
    height: 68,
    borderRadius: 24,
    backgroundColor: colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  permissionTitle: {
    color: colors.white,
    fontSize: 27,
    lineHeight: 31,
    fontWeight: '900',
    textAlign: 'center',
  },
  permissionBody: {
    color: 'rgba(255,255,255,0.62)',
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 24,
  },
  permissionButton: {
    width: '100%',
    marginTop: 9,
  },
  permissionError: {
    color: colors.coral,
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
    marginBottom: 6,
  },
  permissionDivider: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 22,
    marginBottom: 10,
  },
  cameraPage: {
    flex: 1,
    backgroundColor: colors.ink,
    overflow: 'hidden',
  },
  cameraShadeTop: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(22,23,19,0.16)',
  },
  cameraHeader: {
    position: 'absolute',
    left: 18,
    right: 18,
    top: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  cameraTitleWrap: {
    flex: 1,
  },
  cameraTitle: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '900',
  },
  cameraSubtitle: {
    color: 'rgba(255,255,255,0.66)',
    fontSize: 10,
    marginTop: 2,
  },
  cameraCounter: {
    minWidth: 43,
    height: 32,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(22,23,19,0.56)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraCounterText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: '900',
  },
  scanArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanFrame: {
    width: 260,
    height: 260,
  },
  scanCorner: {
    position: 'absolute',
    width: 50,
    height: 50,
    borderColor: colors.lime,
  },
  scanCornerTL: {
    left: 0,
    top: 0,
    borderLeftWidth: 5,
    borderTopWidth: 5,
    borderTopLeftRadius: 16,
  },
  scanCornerTR: {
    right: 0,
    top: 0,
    borderRightWidth: 5,
    borderTopWidth: 5,
    borderTopRightRadius: 16,
  },
  scanCornerBL: {
    left: 0,
    bottom: 0,
    borderLeftWidth: 5,
    borderBottomWidth: 5,
    borderBottomLeftRadius: 16,
  },
  scanCornerBR: {
    right: 0,
    bottom: 0,
    borderRightWidth: 5,
    borderBottomWidth: 5,
    borderBottomRightRadius: 16,
  },
  scanLine: {
    position: 'absolute',
    left: 12,
    right: 12,
    top: '49%',
    height: 2,
    backgroundColor: colors.lime,
    shadowColor: colors.lime,
    shadowOpacity: 0.9,
    shadowRadius: 8,
  },
  scanBusy: {
    position: 'absolute',
    top: -56,
  },
  scanError: {
    position: 'absolute',
    bottom: -74,
    maxWidth: 285,
    borderRadius: 15,
    backgroundColor: 'rgba(196,60,60,0.92)',
    paddingHorizontal: 13,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  scanErrorText: {
    flex: 1,
    color: colors.white,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '700',
  },
  cameraFooter: {
    position: 'absolute',
    left: 18,
    right: 18,
    bottom: 18,
  },
  flashHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    marginBottom: 14,
  },
  flashHintText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '700',
  },
  demoCode: {
    color: 'rgba(255,255,255,0.55)',
    textAlign: 'center',
    fontSize: 9,
    marginTop: 8,
  },
  manualSubmitSpacing: {
    marginBottom: 10,
  },
  manualRow: {
    flexDirection: 'row',
    gap: 9,
  },
  manualInput: {
    flex: 1,
    height: 50,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 15,
    color: colors.white,
    fontWeight: '700',
  },
  manualSubmit: {
    width: 50,
    height: 50,
    borderRadius: 16,
    backgroundColor: colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arLockedPage: {
    flex: 1,
    backgroundColor: colors.ink,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  arLockedCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  arLockedIcon: {
    width: 72,
    height: 72,
    borderRadius: 26,
    backgroundColor: colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 22,
  },
  arLockedTitle: {
    color: colors.white,
    fontSize: 30,
    lineHeight: 33,
    fontWeight: '900',
    letterSpacing: -1,
    textAlign: 'center',
  },
  arLockedBody: {
    color: 'rgba(255,255,255,0.62)',
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 18,
  },
  arPermissionButton: {
    width: '100%',
    marginTop: 18,
  },
  arStage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arDistance: {
    position: 'absolute',
    top: 105,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(22,23,19,0.68)',
    paddingHorizontal: 11,
    minHeight: 30,
  },
  arDistanceText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: '800',
  },
  arCreatureGlow: {
    width: 185,
    height: 210,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 93,
    backgroundColor: 'rgba(200,255,0,0.13)',
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.48)',
    shadowColor: colors.lime,
    shadowOpacity: 0.8,
    shadowRadius: 30,
  },
  arCreature: {
    width: 116,
    height: 102,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  foxEarLeft: {
    position: 'absolute',
    left: 11,
    top: 0,
    width: 49,
    height: 60,
    backgroundColor: colors.coral,
    borderTopLeftRadius: 38,
    transform: [{ rotate: '-25deg' }],
    borderWidth: 3,
    borderColor: colors.white,
  },
  foxEarRight: {
    position: 'absolute',
    right: 11,
    top: 0,
    width: 49,
    height: 60,
    backgroundColor: colors.coral,
    borderTopRightRadius: 38,
    transform: [{ rotate: '25deg' }],
    borderWidth: 3,
    borderColor: colors.white,
  },
  foxFace: {
    width: 92,
    height: 82,
    borderRadius: 38,
    backgroundColor: colors.coral,
    borderWidth: 3,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 26,
  },
  foxEye: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.ink,
    marginTop: 2,
  },
  foxEyeRight: {},
  foxNose: {
    position: 'absolute',
    width: 12,
    height: 9,
    borderRadius: 6,
    backgroundColor: colors.ink,
    bottom: 19,
  },
  arObjectLabel: {
    color: colors.white,
    fontSize: 9,
    letterSpacing: 1.2,
    fontWeight: '900',
    marginTop: 15,
  },
  arFooter: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 22,
    alignItems: 'center',
  },
  arInstruction: {
    color: colors.white,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 14,
  },
  shutterOuter: {
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 4,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: {
    width: 61,
    height: 61,
    borderRadius: 31,
    backgroundColor: colors.lime,
  },
  arFootnote: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 9,
    textAlign: 'center',
    marginTop: 8,
  },
  rewardPage: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  rewardContent: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 36,
    alignItems: 'stretch',
  },
  confettiField: {
    height: 130,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rewardMedal: {
    width: 92,
    height: 92,
    borderRadius: 32,
    backgroundColor: colors.lime,
    borderWidth: 4,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-5deg' }],
  },
  confetti: {
    position: 'absolute',
    width: 10,
    height: 26,
    borderRadius: 4,
  },
  confettiOne: {
    backgroundColor: colors.coral,
    left: 38,
    top: 18,
    transform: [{ rotate: '25deg' }],
  },
  confettiTwo: {
    backgroundColor: colors.cyan,
    right: 44,
    top: 9,
    transform: [{ rotate: '-32deg' }],
  },
  confettiThree: {
    backgroundColor: colors.cyan,
    left: 68,
    bottom: 12,
    transform: [{ rotate: '-17deg' }],
  },
  confettiFour: {
    backgroundColor: colors.limeDeep,
    right: 75,
    bottom: 21,
    transform: [{ rotate: '39deg' }],
  },
  rewardTitle: {
    color: colors.ink,
    fontSize: 42,
    lineHeight: 43,
    fontWeight: '900',
    letterSpacing: -1.8,
    marginTop: 8,
  },
  rewardSubtitle: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 11,
    marginBottom: 22,
  },
  ticket: {
    borderRadius: radii.lg,
    backgroundColor: colors.ink,
    overflow: 'hidden',
    ...shadow,
  },
  ticketTop: {
    padding: 20,
  },
  ticketTitle: {
    color: colors.white,
    fontSize: 24,
    lineHeight: 27,
    fontWeight: '900',
    letterSpacing: -0.7,
    marginTop: 18,
  },
  ticketBody: {
    color: 'rgba(255,255,255,0.62)',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 8,
  },
  ticketTear: {
    height: 30,
    flexDirection: 'row',
    alignItems: 'center',
  },
  ticketNotchLeft: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.paper,
    marginLeft: -11,
  },
  ticketDash: {
    flex: 1,
    height: 1,
    borderTopWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,0.34)',
  },
  ticketNotchRight: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.paper,
    marginRight: -11,
  },
  ticketBottom: {
    paddingHorizontal: 20,
    paddingBottom: 22,
    alignItems: 'center',
  },
  rewardCodeLabel: {
    color: 'rgba(255,255,255,0.48)',
    fontSize: 9,
    letterSpacing: 1.1,
    fontWeight: '900',
  },
  rewardCode: {
    color: colors.lime,
    fontSize: 25,
    letterSpacing: 2.4,
    fontWeight: '900',
    marginTop: 6,
  },
  rewardExpiry: {
    color: 'rgba(255,255,255,0.42)',
    fontSize: 9,
    marginTop: 6,
  },
  rewardStats: {
    flexDirection: 'row',
    gap: 10,
    marginVertical: 14,
  },
  rewardStat: {
    flex: 1,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.md,
    padding: 13,
    alignItems: 'center',
  },
  rewardStatValue: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: '900',
  },
  rewardStatLabel: {
    color: colors.muted,
    fontSize: 9,
    marginTop: 3,
  },
  rewardSecondary: {
    marginTop: 9,
  },
  restartButton: {
    alignSelf: 'center',
    padding: 12,
    marginTop: 4,
  },
  restartText: {
    color: colors.muted,
    fontSize: 11,
    textDecorationLine: 'underline',
  },
});
