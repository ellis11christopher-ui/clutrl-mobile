import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps, ReactNode } from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { colors, radii, shadow } from '../theme';
import type { HuntFormat, HuntTier, Screen } from '../types';

type IconName = ComponentProps<typeof Ionicons>['name'];

// Trail Black background + Beacon Lime symbol, and the inverse pairing, from
// 01_Master_Logos/PNG in the CLUTRL brand kit.
const symbolInkLime = require('../../assets/brand/symbol-ink-lime.png');
const symbolLimeInk = require('../../assets/brand/symbol-lime-ink.png');

export function BrandMark({ inverse = false }: { inverse?: boolean }) {
  return (
    <Image
      source={inverse ? symbolLimeInk : symbolInkLime}
      style={styles.brandMark}
      resizeMode="contain"
    />
  );
}

export function BrandLockup({ inverse = false }: { inverse?: boolean }) {
  return (
    <View style={styles.brandLockup}>
      <BrandMark inverse={inverse} />
      <Text style={[styles.brandName, inverse && styles.brandNameInverse]}>
        CLU<Text style={styles.brandSlash}>/</Text>TRL
      </Text>
    </View>
  );
}

export function Pill({
  children,
  tone = 'light',
  icon,
}: {
  children: ReactNode;
  tone?: 'light' | 'dark' | 'lime' | 'cyan' | 'coral';
  icon?: IconName;
}) {
  return (
    <View style={[styles.pill, pillTones[tone]]}>
      {icon ? (
        <Ionicons
          name={icon}
          size={13}
          color={tone === 'dark' ? colors.white : colors.ink}
        />
      ) : null}
      <Text
        style={[styles.pillText, tone === 'dark' && styles.pillTextInverse]}
      >
        {children}
      </Text>
    </View>
  );
}

export function PrimaryButton({
  label,
  icon,
  variant = 'dark',
  style,
  ...pressableProps
}: PressableProps & {
  label: string;
  icon?: IconName;
  variant?: 'dark' | 'lime' | 'light' | 'outline' | 'coral';
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.button,
        buttonVariants[variant],
        pressed && styles.buttonPressed,
        style,
      ]}
      {...pressableProps}
    >
      <Text
        style={[
          styles.buttonText,
          (variant === 'light' || variant === 'lime') && styles.buttonTextDark,
        ]}
      >
        {label}
      </Text>
      {icon ? (
        <Ionicons
          name={icon}
          size={19}
          color={
            variant === 'light' || variant === 'lime' ? colors.ink : colors.white
          }
        />
      ) : null}
    </Pressable>
  );
}

export function IconButton({
  icon,
  inverse = false,
  ...props
}: PressableProps & { icon: IconName; inverse?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.iconButton,
        inverse && styles.iconButtonInverse,
        pressed && styles.buttonPressed,
      ]}
      {...props}
    >
      <Ionicons
        name={icon}
        size={20}
        color={inverse ? colors.white : colors.ink}
      />
    </Pressable>
  );
}

export function ProgressBar({
  value,
  total,
  inverse = false,
}: {
  value: number;
  total: number;
  inverse?: boolean;
}) {
  const percent = Math.max(0, Math.min(100, (value / total) * 100));
  return (
    <View style={[styles.track, inverse && styles.trackInverse]}>
      <View
        style={[
          styles.progress,
          inverse && styles.progressInverse,
          { width: `${percent}%` },
        ]}
      />
    </View>
  );
}

export function TierBadge({ tier }: { tier: HuntTier }) {
  const label = tier === 'base' ? 'BASE' : tier === 'live' ? 'LIVE' : 'IMMERSIVE';
  const icon: IconName =
    tier === 'base' ? 'scan-outline' : tier === 'live' ? 'navigate' : 'sparkles';
  return (
    <Pill tone={tier === 'immersive' ? 'cyan' : tier === 'live' ? 'lime' : 'light'} icon={icon}>
      {label}
    </Pill>
  );
}

const formatMeta: Record<HuntFormat, { label: string; icon: IconName }> = {
  pista: { label: 'PISTA', icon: 'trail-sign-outline' },
  hare_hounds: { label: 'HARE & HOUNDS', icon: 'shuffle' },
  quest: { label: 'QUEST', icon: 'book-outline' },
  ar: { label: 'AR', icon: 'cube-outline' },
  live: { label: 'LIVE', icon: 'flash' },
};

export function FormatBadge({ format }: { format: HuntFormat }) {
  const meta = formatMeta[format];
  return (
    <Pill tone={format === 'hare_hounds' || format === 'live' ? 'coral' : 'cyan'} icon={meta.icon}>
      {meta.label}
    </Pill>
  );
}

export function SectionLabel({
  children,
  inverse = false,
}: {
  children: ReactNode;
  inverse?: boolean;
}) {
  return (
    <Text style={[styles.sectionLabel, inverse && styles.sectionLabelInverse]}>
      {children}
    </Text>
  );
}

export function BottomNav({
  active,
  onNavigate,
}: {
  active: 'hunt' | 'master' | 'settings';
  onNavigate: (screen: Screen) => void;
}) {
  const items: {
    key: typeof active;
    label: string;
    icon: IconName;
    screen: Screen;
  }[] = [
    { key: 'hunt', label: 'Hunt', icon: 'compass-outline', screen: 'home' },
    { key: 'master', label: 'Master', icon: 'map-outline', screen: 'master' },
    { key: 'settings', label: 'Demo', icon: 'options-outline', screen: 'settings' },
  ];

  return (
    <View style={styles.bottomNav}>
      {items.map((item) => {
        const selected = item.key === active;
        return (
          <Pressable
            key={item.key}
            accessibilityRole="button"
            onPress={() => onNavigate(item.screen)}
            style={styles.navItem}
          >
            <View style={[styles.navIcon, selected && styles.navIconSelected]}>
              <Ionicons
                name={selected ? (item.icon.replace('-outline', '') as IconName) : item.icon}
                size={20}
                color={selected ? colors.ink : colors.muted}
              />
            </View>
            <Text style={[styles.navLabel, selected && styles.navLabelSelected]}>
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function ScreenTitle({
  eyebrow,
  title,
  onBack,
  inverse = false,
  action,
}: {
  eyebrow?: string;
  title: string;
  onBack?: () => void;
  inverse?: boolean;
  action?: ReactNode;
}) {
  return (
    <View style={styles.screenTitleRow}>
      {onBack ? (
        <IconButton icon="arrow-back" onPress={onBack} inverse={inverse} />
      ) : null}
      <View style={styles.screenTitleCopy}>
        {eyebrow ? (
          <SectionLabel inverse={inverse}>{eyebrow}</SectionLabel>
        ) : null}
        <Text style={[styles.screenTitle, inverse && styles.screenTitleInverse]}>
          {title}
        </Text>
      </View>
      {action}
    </View>
  );
}

export const commonStyles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 120,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 18,
  },
  title: {
    color: colors.ink,
    fontSize: 32,
    lineHeight: 35,
    letterSpacing: -1.2,
    fontWeight: '900',
  },
  body: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
  },
});

const pillTones = StyleSheet.create({
  light: { backgroundColor: colors.paper },
  dark: { backgroundColor: colors.ink },
  lime: { backgroundColor: colors.lime },
  cyan: { backgroundColor: colors.cyan },
  coral: { backgroundColor: colors.coral },
});

const buttonVariants = StyleSheet.create({
  dark: { backgroundColor: colors.ink },
  lime: { backgroundColor: colors.lime },
  light: { backgroundColor: colors.white },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.line,
  },
  coral: { backgroundColor: colors.coral },
});

const styles = StyleSheet.create({
  brandMark: {
    width: 38,
    height: 38,
  },
  brandLockup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  brandName: {
    color: colors.ink,
    fontWeight: '900',
    letterSpacing: 1.2,
    fontSize: 16,
  },
  brandNameInverse: {
    color: colors.white,
  },
  brandSlash: {
    color: colors.lime,
  },
  pill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 28,
    paddingHorizontal: 10,
    borderRadius: radii.pill,
  },
  pillText: {
    color: colors.ink,
    fontSize: 10,
    letterSpacing: 0.7,
    fontWeight: '900',
  },
  pillTextInverse: {
    color: colors.white,
  },
  button: {
    minHeight: 56,
    borderRadius: radii.md,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  buttonPressed: {
    opacity: 0.72,
    transform: [{ scale: 0.985 }],
  },
  buttonText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '900',
  },
  buttonTextDark: {
    color: colors.ink,
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 15,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonInverse: {
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderColor: 'rgba(255,255,255,0.20)',
  },
  track: {
    height: 7,
    backgroundColor: colors.sand,
    borderRadius: radii.pill,
    overflow: 'hidden',
  },
  trackInverse: {
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  progress: {
    height: '100%',
    backgroundColor: colors.ink,
    borderRadius: radii.pill,
  },
  progressInverse: {
    backgroundColor: colors.lime,
  },
  sectionLabel: {
    color: colors.muted,
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    fontWeight: '900',
  },
  sectionLabelInverse: {
    color: 'rgba(255,255,255,0.65)',
  },
  bottomNav: {
    position: 'absolute',
    left: 18,
    right: 18,
    bottom: 12,
    height: 72,
    borderRadius: 25,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    flexDirection: 'row',
    padding: 7,
    ...shadow,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  navIcon: {
    width: 34,
    height: 29,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
  },
  navIconSelected: {
    backgroundColor: colors.lime,
  },
  navLabel: {
    color: colors.muted,
    fontSize: 9,
    fontWeight: '800',
  },
  navLabelSelected: {
    color: colors.ink,
  },
  screenTitleRow: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  screenTitleCopy: {
    flex: 1,
  },
  screenTitle: {
    color: colors.ink,
    fontSize: 24,
    lineHeight: 28,
    letterSpacing: -0.7,
    fontWeight: '900',
  },
  screenTitleInverse: {
    color: colors.white,
  },
});
