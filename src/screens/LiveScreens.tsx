import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  BottomNav,
  IconButton,
  Pill,
  PrimaryButton,
  ProgressBar,
  ScreenTitle,
  SectionLabel,
  TierBadge,
  commonStyles,
} from '../components/ui';
import { participants } from '../data/demo';
import { colors, radii, shadow } from '../theme';
import type {
  ChatMessage,
  Coordinates,
  Hunt,
  HuntTier,
  Participant,
  Screen,
} from '../types';

export function TrackingScreen({
  tier,
  onBack,
  onChat,
}: {
  tier: HuntTier;
  onBack: () => void;
  onChat: () => void;
}) {
  const [permissionState, setPermissionState] = useState<
    'idle' | 'requesting' | 'granted' | 'denied'
  >('idle');
  const [coordinates, setCoordinates] = useState<Coordinates | null>(null);

  useEffect(() => {
    let active = true;
    let subscription: Location.LocationSubscription | undefined;

    async function start() {
      if (tier === 'base') return;
      setPermissionState('requesting');
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!active) return;
      if (!permission.granted) {
        setPermissionState('denied');
        return;
      }
      setPermissionState('granted');
      subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 5000,
          distanceInterval: 8,
        },
        (position) => {
          if (!active) return;
          setCoordinates({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        },
      );
    }

    void start();
    return () => {
      active = false;
      subscription?.remove();
    };
  }, [tier]);

  if (tier === 'base') {
    return (
      <FeatureGate
        icon="navigate"
        title="Live location starts here"
        body="The Live tier lets hunters share their position during an active hunt and gives the Hunt Master a real-time team view."
        tier="live"
        onBack={onBack}
      />
    );
  }

  return (
    <View style={commonStyles.page}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.trackingContent}
      >
        <ScreenTitle
          eyebrow="Hunter location"
          title="You’re on the map"
          onBack={onBack}
          action={<TierBadge tier={tier} />}
        />

        <View style={styles.locationStatus}>
          <View
            style={[
              styles.statusDot,
              permissionState === 'denied' && styles.statusDotDenied,
            ]}
          />
          <Text style={styles.locationStatusText}>
            {permissionState === 'granted'
              ? 'Sharing while this hunt is open'
              : permissionState === 'denied'
                ? 'Location permission is off'
                : 'Connecting to location…'}
          </Text>
          <Text style={styles.locationStatusMeta}>Foreground only</Text>
        </View>

        <GeoMap
          selfCoordinates={coordinates}
          showAll={false}
          compact={false}
        />

        <View style={styles.coordinateCard}>
          <View style={styles.coordinateIcon}>
            <Ionicons name="navigate" size={20} color={colors.ink} />
          </View>
          <View style={styles.coordinateCopy}>
            <Text style={styles.coordinateTitle}>Current location</Text>
            <Text style={styles.coordinateValue}>
              {coordinates
                ? `${coordinates.latitude.toFixed(5)}, ${coordinates.longitude.toFixed(5)}`
                : 'Waiting for a device GPS fix'}
            </Text>
          </View>
          <Pill tone="lime">LIVE</Pill>
        </View>

        <View style={styles.privacyCard}>
          <Ionicons name="shield-checkmark-outline" size={22} color={colors.cyan} />
          <View style={styles.privacyCopy}>
            <Text style={styles.privacyTitle}>Built for event-time privacy</Text>
            <Text style={styles.privacyBody}>
              Tracking starts only after opt-in and ends automatically when the
              hunt closes. Production data expires on the organizer’s retention
              schedule.
            </Text>
          </View>
        </View>

        <PrimaryButton
          label="Message the Hunt Master"
          icon="chatbubble-outline"
          onPress={onChat}
        />
      </ScrollView>
    </View>
  );
}

export function ChatScreen({
  tier,
  messages,
  onBack,
  onSend,
}: {
  tier: HuntTier;
  messages: ChatMessage[];
  onBack: () => void;
  onSend: (body: string, from?: 'hunter' | 'master') => void;
}) {
  const [draft, setDraft] = useState('');

  function send() {
    const body = draft.trim();
    if (!body) return;
    onSend(body, 'hunter');
    setDraft('');
  }

  if (tier === 'base') {
    return (
      <FeatureGate
        icon="chatbubbles"
        title="Help, right when it matters"
        body="The Live tier adds one-to-one clue assistance between hunters and the Hunt Master."
        tier="live"
        onBack={onBack}
      />
    );
  }

  return (
    <KeyboardAvoidingView
      style={commonStyles.page}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.chatHeader}>
        <IconButton icon="arrow-back" onPress={onBack} />
        <View style={styles.chatAvatar}>
          <Text style={styles.chatAvatarText}>HM</Text>
          <View style={styles.chatOnline} />
        </View>
        <View style={styles.chatHeaderCopy}>
          <Text style={styles.chatName}>Hunt Master</Text>
          <Text style={styles.chatStatus}>Online · usually replies fast</Text>
        </View>
        <Ionicons name="shield-checkmark" size={19} color={colors.cyan} />
      </View>

      <ScrollView
        contentContainerStyle={styles.messages}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.messageDate}>
          <Text style={styles.messageDateText}>TONIGHT’S HUNT</Text>
        </View>
        {messages.map((message) => (
          <View
            key={message.id}
            style={[
              styles.messageRow,
              message.from === 'hunter' && styles.messageRowHunter,
            ]}
          >
            <View
              style={[
                styles.messageBubble,
                message.from === 'hunter'
                  ? styles.messageBubbleHunter
                  : styles.messageBubbleMaster,
              ]}
            >
              <Text
                style={[
                  styles.messageText,
                  message.from === 'hunter' && styles.messageTextHunter,
                ]}
              >
                {message.body}
              </Text>
              <Text
                style={[
                  styles.messageTime,
                  message.from === 'hunter' && styles.messageTimeHunter,
                ]}
              >
                {message.time}
              </Text>
            </View>
          </View>
        ))}
        <View style={styles.quickPrompts}>
          <Text style={styles.quickLabel}>QUICK ASK</Text>
          <View style={styles.quickRow}>
            {['A small hint?', 'QR missing', 'Safety issue'].map((label) => (
              <Pressable
                key={label}
                style={styles.quickPill}
                onPress={() => setDraft(label)}
              >
                <Text style={styles.quickPillText}>{label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>

      <View style={styles.composer}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          style={styles.composerInput}
          placeholder="Ask for clue assistance…"
          placeholderTextColor={colors.muted}
          multiline
          maxLength={500}
        />
        <Pressable
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.sendButton,
            !draft.trim() && styles.sendButtonDisabled,
            pressed && styles.pressed,
          ]}
          onPress={send}
          disabled={!draft.trim()}
        >
          <Ionicons name="arrow-up" size={20} color={colors.ink} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

export function MasterScreen({
  hunt,
  tier,
  onNavigate,
}: {
  hunt: Hunt;
  tier: HuntTier;
  onNavigate: (screen: Screen) => void;
}) {
  const activeParticipants = participants.filter((item) => item.status !== 'paused')
    .length;
  const helpCount = participants.filter((item) => item.status === 'help').length;

  return (
    <View style={commonStyles.page}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.masterContent}
      >
        <View style={styles.masterTop}>
          <View>
            <SectionLabel>Hunt Master console</SectionLabel>
            <Text style={styles.masterTitle}>{hunt.name}</Text>
          </View>
          <TierBadge tier={tier} />
        </View>

        <View style={styles.masterStats}>
          <MasterStat value="24" label="joined" color={colors.lime} />
          <MasterStat value={String(activeParticipants)} label="active demo teams" color={colors.cyan} />
          <MasterStat value={String(helpCount)} label="needs help" color={colors.coral} />
        </View>

        <View style={styles.mapHeader}>
          <View>
            <SectionLabel>Live field view</SectionLabel>
            <Text style={styles.mapTitle}>Teams on the route</Text>
          </View>
          <Pill tone={tier === 'base' ? 'light' : 'lime'} icon="radio-button-on">
            {tier === 'base' ? 'LOCKED' : 'LIVE'}
          </Pill>
        </View>

        <View style={tier === 'base' ? styles.lockedMapWrap : undefined}>
          <GeoMap showAll compact selfCoordinates={null} />
          {tier === 'base' ? (
            <View style={styles.mapLockOverlay}>
              <View style={styles.mapLockIcon}>
                <Ionicons name="lock-closed" size={19} color={colors.ink} />
              </View>
              <Text style={styles.mapLockTitle}>Live tier required</Text>
              <Text style={styles.mapLockBody}>
                Switch tiers in Demo to preview active GPS tracking.
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.teamHeader}>
          <SectionLabel>Team pulse</SectionLabel>
          <Text style={styles.teamHeaderLink}>View all 24</Text>
        </View>
        <View style={styles.teamList}>
          {participants.map((participant) => (
            <ParticipantRow participant={participant} key={participant.id} />
          ))}
        </View>

        <View style={styles.masterTools}>
          <SectionLabel>Hunt operations</SectionLabel>
          <View style={styles.toolGrid}>
            <ToolButton
              icon="qr-code-outline"
              label="QR print pack"
              onPress={() =>
                Alert.alert(
                  'QR print pack',
                  'The working build includes a printable 10-code HTML sheet.',
                )
              }
            />
            <ToolButton
              icon="megaphone-outline"
              label="Broadcast"
              onPress={() =>
                Alert.alert('Broadcast', 'Push notification composer is a backend milestone.')
              }
            />
            <ToolButton
              icon="gift-outline"
              label="Rewards"
              onPress={() =>
                Alert.alert('Reward configured', hunt.rewardTitle)
              }
            />
            <ToolButton
              icon="analytics-outline"
              label="Analytics"
              onPress={() =>
                Alert.alert('Analytics preview', 'Completion and sponsor events are specified in the blueprint.')
              }
            />
          </View>
        </View>
      </ScrollView>

      <BottomNav active="master" onNavigate={onNavigate} />
    </View>
  );
}

function ParticipantRow({ participant }: { participant: Participant }) {
  const statusLabel =
    participant.status === 'moving'
      ? 'Moving'
      : participant.status === 'help'
        ? 'Needs help'
        : 'Paused';

  return (
    <View style={styles.participantRow}>
      <View
        style={[styles.participantAvatar, { backgroundColor: participant.color }]}
      >
        <Text style={styles.participantInitials}>{participant.initials}</Text>
      </View>
      <View style={styles.participantCopy}>
        <Text style={styles.participantName}>{participant.name}</Text>
        <View style={styles.participantMeta}>
          <Text style={styles.participantMetaText}>
            {participant.progress}/10
          </Text>
          <View style={styles.metaDivider} />
          <Text
            style={[
              styles.participantMetaText,
              participant.status === 'help' && styles.helpText,
            ]}
          >
            {statusLabel}
          </Text>
        </View>
      </View>
      <View style={styles.participantProgress}>
        <ProgressBar value={participant.progress} total={10} />
      </View>
      <Text style={styles.lastSeen}>{participant.lastSeen}</Text>
    </View>
  );
}

function MasterStat({
  value,
  label,
  color,
}: {
  value: string;
  label: string;
  color: string;
}) {
  return (
    <View style={[styles.masterStat, { backgroundColor: color }]}>
      <Text style={styles.masterStatValue}>{value}</Text>
      <Text style={styles.masterStatLabel}>{label}</Text>
    </View>
  );
}

function ToolButton({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.toolButton, pressed && styles.pressed]}
      onPress={onPress}
    >
      <View style={styles.toolIcon}>
        <Ionicons name={icon} size={21} color={colors.ink} />
      </View>
      <Text style={styles.toolLabel}>{label}</Text>
      <Ionicons name="chevron-forward" size={16} color={colors.muted} />
    </Pressable>
  );
}

function GeoMap({
  selfCoordinates,
  showAll,
  compact,
}: {
  selfCoordinates: Coordinates | null;
  showAll: boolean;
  compact: boolean;
}) {
  const positionLabel = useMemo(() => {
    if (!selfCoordinates) return null;
    return `${selfCoordinates.latitude.toFixed(3)}, ${selfCoordinates.longitude.toFixed(3)}`;
  }, [selfCoordinates]);

  return (
    <View style={[styles.map, compact && styles.mapCompact]}>
      <View style={[styles.road, styles.roadOne]} />
      <View style={[styles.road, styles.roadTwo]} />
      <View style={[styles.road, styles.roadThree]} />
      <View style={styles.mapBlockOne} />
      <View style={styles.mapBlockTwo} />
      <View style={styles.mapBlockThree} />
      <View style={styles.mapRouteOne} />
      <View style={styles.mapRouteTwo} />
      {showAll
        ? participants.map((participant) => (
            <View
              key={participant.id}
              style={[
                styles.mapMarker,
                {
                  backgroundColor: participant.color,
                  left: `${participant.mapX}%`,
                  top: `${participant.mapY}%`,
                },
              ]}
            >
              <Text style={styles.mapMarkerText}>{participant.initials}</Text>
            </View>
          ))
        : null}
      {!showAll ? (
        <View style={styles.selfMarker}>
          <View style={styles.selfPulse} />
          <View style={styles.selfDot}>
            <Ionicons name="navigate" size={17} color={colors.ink} />
          </View>
        </View>
      ) : null}
      <View style={styles.mapLabel}>
        <Text style={styles.mapLabelText}>
          {positionLabel ?? 'LAS VEGAS ARTS DISTRICT'}
        </Text>
      </View>
    </View>
  );
}

function FeatureGate({
  icon,
  title,
  body,
  tier,
  onBack,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
  tier: HuntTier;
  onBack: () => void;
}) {
  return (
    <View style={styles.gatePage}>
      <IconButton icon="arrow-back" onPress={onBack} />
      <View style={styles.gateCenter}>
        <View style={styles.gateIcon}>
          <Ionicons name={icon} size={30} color={colors.ink} />
        </View>
        <TierBadge tier={tier} />
        <Text style={styles.gateTitle}>{title}</Text>
        <Text style={styles.gateBody}>{body}</Text>
        <Text style={styles.gateNote}>
          Switch the prototype tier from the Demo tab to preview this feature.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.7,
  },
  trackingContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 40,
  },
  locationStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 19,
    marginBottom: 11,
  },
  statusDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.success,
    marginRight: 8,
  },
  statusDotDenied: {
    backgroundColor: colors.danger,
  },
  locationStatusText: {
    color: colors.ink,
    fontSize: 11,
    fontWeight: '800',
    flex: 1,
  },
  locationStatusMeta: {
    color: colors.muted,
    fontSize: 9,
  },
  map: {
    height: 330,
    borderRadius: radii.lg,
    backgroundColor: '#E7E2D7',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.line,
  },
  mapCompact: {
    height: 270,
  },
  road: {
    position: 'absolute',
    backgroundColor: colors.white,
    borderColor: '#CAC3B7',
    borderWidth: 1,
  },
  roadOne: {
    width: 500,
    height: 38,
    left: -80,
    top: 108,
    transform: [{ rotate: '-16deg' }],
  },
  roadTwo: {
    width: 38,
    height: 500,
    left: 130,
    top: -70,
    transform: [{ rotate: '10deg' }],
  },
  roadThree: {
    width: 36,
    height: 440,
    right: 65,
    top: -40,
    transform: [{ rotate: '-11deg' }],
  },
  mapBlockOne: {
    position: 'absolute',
    width: 80,
    height: 55,
    left: 22,
    top: 35,
    borderRadius: 8,
    backgroundColor: '#D6CDBD',
  },
  mapBlockTwo: {
    position: 'absolute',
    width: 105,
    height: 67,
    right: 24,
    top: 166,
    borderRadius: 8,
    backgroundColor: '#D6CDBD',
  },
  mapBlockThree: {
    position: 'absolute',
    width: 88,
    height: 61,
    left: 54,
    bottom: 25,
    borderRadius: 8,
    backgroundColor: '#D6CDBD',
  },
  mapRouteOne: {
    position: 'absolute',
    width: 220,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.cyan,
    left: 76,
    top: 155,
    transform: [{ rotate: '37deg' }],
  },
  mapRouteTwo: {
    position: 'absolute',
    width: 130,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.cyan,
    left: 52,
    top: 221,
    transform: [{ rotate: '-48deg' }],
  },
  mapMarker: {
    position: 'absolute',
    width: 35,
    height: 35,
    borderRadius: 13,
    borderWidth: 3,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -18,
    marginTop: -18,
    ...shadow,
  },
  mapMarkerText: {
    color: colors.ink,
    fontSize: 8,
    fontWeight: '900',
  },
  selfMarker: {
    position: 'absolute',
    left: '52%',
    top: '45%',
    width: 80,
    height: 80,
    marginLeft: -40,
    marginTop: -40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selfPulse: {
    position: 'absolute',
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: 'rgba(110,91,244,0.22)',
    borderWidth: 1,
    borderColor: 'rgba(110,91,244,0.36)',
  },
  selfDot: {
    width: 42,
    height: 42,
    borderRadius: 16,
    backgroundColor: colors.lime,
    borderWidth: 3,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow,
  },
  mapLabel: {
    position: 'absolute',
    left: 10,
    bottom: 10,
    minHeight: 25,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.90)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapLabelText: {
    color: colors.muted,
    fontSize: 8,
    letterSpacing: 0.5,
    fontWeight: '900',
  },
  coordinateCard: {
    marginTop: 11,
    padding: 13,
    borderRadius: radii.md,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  coordinateIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: colors.cyan,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coordinateCopy: {
    flex: 1,
  },
  coordinateTitle: {
    color: colors.ink,
    fontSize: 11,
    fontWeight: '900',
  },
  coordinateValue: {
    color: colors.muted,
    fontSize: 9,
    marginTop: 3,
  },
  privacyCard: {
    marginVertical: 12,
    borderRadius: radii.md,
    backgroundColor: '#EDE9FF',
    padding: 14,
    flexDirection: 'row',
    gap: 11,
  },
  privacyCopy: {
    flex: 1,
  },
  privacyTitle: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: '900',
  },
  privacyBody: {
    color: colors.muted,
    fontSize: 10,
    lineHeight: 15,
    marginTop: 3,
  },
  chatHeader: {
    minHeight: 68,
    paddingHorizontal: 18,
    paddingBottom: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  chatAvatar: {
    width: 42,
    height: 42,
    borderRadius: 15,
    backgroundColor: colors.cyan,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatAvatarText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '900',
  },
  chatOnline: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.lime,
    borderWidth: 2,
    borderColor: colors.paper,
  },
  chatHeaderCopy: {
    flex: 1,
  },
  chatName: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '900',
  },
  chatStatus: {
    color: colors.muted,
    fontSize: 9,
    marginTop: 2,
  },
  messages: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 25,
  },
  messageDate: {
    alignSelf: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
    backgroundColor: colors.sand,
    marginBottom: 18,
  },
  messageDateText: {
    color: colors.muted,
    fontSize: 8,
    letterSpacing: 0.8,
    fontWeight: '900',
  },
  messageRow: {
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  messageRowHunter: {
    alignItems: 'flex-end',
  },
  messageBubble: {
    maxWidth: '80%',
    borderRadius: 19,
    paddingHorizontal: 14,
    paddingTop: 11,
    paddingBottom: 8,
  },
  messageBubbleMaster: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderBottomLeftRadius: 6,
  },
  messageBubbleHunter: {
    backgroundColor: colors.ink,
    borderBottomRightRadius: 6,
  },
  messageText: {
    color: colors.ink,
    fontSize: 13,
    lineHeight: 19,
  },
  messageTextHunter: {
    color: colors.white,
  },
  messageTime: {
    color: colors.muted,
    fontSize: 8,
    marginTop: 5,
  },
  messageTimeHunter: {
    color: 'rgba(255,255,255,0.46)',
  },
  quickPrompts: {
    marginTop: 14,
  },
  quickLabel: {
    color: colors.muted,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  quickRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  quickPill: {
    minHeight: 34,
    paddingHorizontal: 12,
    borderRadius: radii.pill,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickPillText: {
    color: colors.ink,
    fontSize: 10,
    fontWeight: '800',
  },
  composer: {
    minHeight: 76,
    paddingHorizontal: 15,
    paddingTop: 9,
    paddingBottom: 8,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.white,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  composerInput: {
    flex: 1,
    minHeight: 50,
    maxHeight: 95,
    borderRadius: 18,
    backgroundColor: colors.paper,
    paddingHorizontal: 15,
    paddingVertical: 13,
    color: colors.ink,
    fontSize: 13,
  },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: 17,
    backgroundColor: colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.35,
  },
  masterContent: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 120,
  },
  masterTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  masterTitle: {
    color: colors.ink,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.8,
    marginTop: 4,
  },
  masterStats: {
    flexDirection: 'row',
    gap: 9,
    marginTop: 20,
  },
  masterStat: {
    flex: 1,
    minHeight: 89,
    padding: 12,
    borderRadius: radii.md,
    justifyContent: 'flex-end',
  },
  masterStatValue: {
    color: colors.ink,
    fontSize: 24,
    fontWeight: '900',
  },
  masterStatLabel: {
    color: 'rgba(22,23,19,0.64)',
    fontSize: 8,
    lineHeight: 11,
    fontWeight: '800',
    marginTop: 2,
  },
  mapHeader: {
    marginTop: 27,
    marginBottom: 11,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  mapTitle: {
    color: colors.ink,
    fontSize: 19,
    fontWeight: '900',
    marginTop: 3,
  },
  lockedMapWrap: {
    position: 'relative',
  },
  mapLockOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    borderRadius: radii.lg,
    backgroundColor: 'rgba(22,23,19,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  mapLockIcon: {
    width: 48,
    height: 48,
    borderRadius: 17,
    backgroundColor: colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapLockTitle: {
    color: colors.white,
    fontSize: 17,
    fontWeight: '900',
    marginTop: 12,
  },
  mapLockBody: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 10,
    lineHeight: 15,
    textAlign: 'center',
    marginTop: 5,
  },
  teamHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 25,
    marginBottom: 9,
  },
  teamHeaderLink: {
    color: colors.cyan,
    fontSize: 10,
    fontWeight: '800',
  },
  teamList: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    overflow: 'hidden',
  },
  participantRow: {
    minHeight: 69,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  participantAvatar: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  participantInitials: {
    color: colors.ink,
    fontSize: 9,
    fontWeight: '900',
  },
  participantCopy: {
    flex: 1,
  },
  participantName: {
    color: colors.ink,
    fontSize: 11,
    fontWeight: '900',
  },
  participantMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 3,
  },
  participantMetaText: {
    color: colors.muted,
    fontSize: 9,
  },
  helpText: {
    color: colors.coral,
    fontWeight: '800',
  },
  metaDivider: {
    width: 2,
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.muted,
  },
  participantProgress: {
    width: 55,
  },
  lastSeen: {
    width: 23,
    textAlign: 'right',
    color: colors.muted,
    fontSize: 8,
  },
  masterTools: {
    marginTop: 24,
  },
  toolGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 9,
    marginTop: 9,
  },
  toolButton: {
    width: '48.5%',
    minHeight: 86,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.md,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  toolIcon: {
    width: 36,
    height: 36,
    borderRadius: 13,
    backgroundColor: colors.paper,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolLabel: {
    flex: 1,
    color: colors.ink,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '900',
  },
  gatePage: {
    flex: 1,
    backgroundColor: colors.paper,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  gateCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  gateIcon: {
    width: 76,
    height: 76,
    borderRadius: 27,
    backgroundColor: colors.lime,
    borderWidth: 3,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    ...shadow,
  },
  gateTitle: {
    color: colors.ink,
    fontSize: 31,
    lineHeight: 34,
    letterSpacing: -1.1,
    fontWeight: '900',
    textAlign: 'center',
    marginTop: 17,
  },
  gateBody: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginTop: 10,
  },
  gateNote: {
    color: colors.cyan,
    fontSize: 10,
    lineHeight: 15,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 18,
  },
});
