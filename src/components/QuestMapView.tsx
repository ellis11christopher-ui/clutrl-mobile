import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radii } from '../theme';
import type { QuestMapViewProps } from './QuestMapView.types';

// Default (web) implementation. Metro prefers QuestMapView.native.tsx on
// device, so this file is what the web bundle and TypeScript resolve.
//
// react-native-maps ships no web implementation, so the web build gets this
// stand-in instead of failing to bundle. It deliberately shows the same facts
// the real map encodes — play area, whether a pin exists, and its coordinates
// — so the surrounding Quest flow stays verifiable in a browser. The actual
// map is only meaningful on a device anyway, where there is a real GPS fix.
export function QuestMapView({
  venueLatitude,
  venueLongitude,
  playRadiusMeters,
  pinLatitude,
  pinLongitude,
  style,
}: QuestMapViewProps) {
  const hasPin = pinLatitude != null && pinLongitude != null;

  return (
    <View style={[styles.wrap, style]}>
      <View style={styles.badge}>
        <Ionicons name="map-outline" size={16} color={colors.ink} />
        <Text style={styles.badgeText}>MAP PREVIEW (DEVICE ONLY)</Text>
      </View>

      <View style={styles.pinRow}>
        <View style={[styles.pinDot, !hasPin && styles.pinDotEmpty]} />
        <Text style={styles.pinLabel}>
          {hasPin ? 'Target placed' : 'No target placed yet'}
        </Text>
      </View>

      {hasPin ? (
        <Text style={styles.coords}>
          {pinLatitude!.toFixed(5)}, {pinLongitude!.toFixed(5)}
        </Text>
      ) : null}

      <Text style={styles.meta}>
        Play area {playRadiusMeters} m around {venueLatitude.toFixed(4)},{' '}
        {venueLongitude.toFixed(4)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.sand,
    padding: 16,
    justifyContent: 'center',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
  },
  badgeText: {
    color: colors.ink,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  pinRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
  },
  pinDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.danger,
  },
  pinDotEmpty: {
    backgroundColor: colors.line,
  },
  pinLabel: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '800',
  },
  coords: {
    marginTop: 6,
    color: colors.muted,
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  meta: {
    marginTop: 10,
    color: colors.muted,
    fontSize: 11,
    lineHeight: 16,
  },
});
