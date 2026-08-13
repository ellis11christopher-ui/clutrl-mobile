import { Ionicons } from '@expo/vector-icons';
import { useAudioPlayer } from 'expo-audio';
import * as Location from 'expo-location';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { QuestMapView } from '../components/QuestMapView';
import {
  IconButton,
  Pill,
  PrimaryButton,
  SectionLabel,
  commonStyles,
} from '../components/ui';
import {
  anchorQuestVenue,
  findVenuesNear,
  resolveChapterPlacement,
  venueTypeLabel,
  type QuestVenue,
} from '../lib/quest';
import {
  randomPlacementWithin,
  resolveSlots,
  type Coordinate,
} from '../lib/questPlacement';
import { colors, radii } from '../theme';
import type { LocationSlot } from '../types';

// ---------------------------------------------------------------------------
// Venue picker
// ---------------------------------------------------------------------------

type VenueState =
  | { status: 'locating' }
  | { status: 'denied' }
  | { status: 'searching'; position: Coordinate }
  | { status: 'empty'; position: Coordinate }
  | { status: 'ready'; position: Coordinate; venues: QuestVenue[] }
  | { status: 'error'; message: string };

/**
 * Finds the vetted venues near the player and anchors the quest to one.
 *
 * An empty result is treated as a first-class outcome, not an error. It has
 * two legitimate causes — no registry coverage here, or everything nearby is
 * already closed for the evening — and in neither case is there a fallback:
 * offering an unvetted location is the exact thing the venue policy exists to
 * prevent, so the screen says no and stops.
 */
export function QuestVenueScreen({
  membershipId,
  onAnchored,
  onBack,
}: {
  membershipId: string;
  onAnchored: (venue: QuestVenue) => void;
  onBack: () => void;
}) {
  const [state, setState] = useState<VenueState>({ status: 'locating' });
  const [anchoringId, setAnchoringId] = useState<string | null>(null);

  const search = useCallback(async () => {
    setState({ status: 'locating' });
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        setState({ status: 'denied' });
        return;
      }
      const fix = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const position = {
        latitude: fix.coords.latitude,
        longitude: fix.coords.longitude,
      };
      setState({ status: 'searching', position });

      const venues = await findVenuesNear(position.latitude, position.longitude);
      setState(
        venues.length === 0
          ? { status: 'empty', position }
          : { status: 'ready', position, venues },
      );
    } catch (err) {
      setState({
        status: 'error',
        message: err instanceof Error ? err.message : 'Could not find venues.',
      });
    }
  }, []);

  useEffect(() => {
    void search();
  }, [search]);

  async function choose(venue: QuestVenue) {
    setAnchoringId(venue.id);
    try {
      await anchorQuestVenue(membershipId, venue.id);
      onAnchored(venue);
    } catch (err) {
      setState({
        status: 'error',
        message: err instanceof Error ? err.message : 'Could not start here.',
      });
    } finally {
      setAnchoringId(null);
    }
  }

  return (
    <View style={commonStyles.page}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <View style={styles.header}>
          <IconButton icon="chevron-back" onPress={onBack} />
          <SectionLabel>CLU/TRL Quest</SectionLabel>
        </View>

        <Text style={styles.title}>Where are you playing?</Text>
        <Text style={styles.body}>
          Quest only runs in public parks, city trails, municipal fields, and
          public outdoor arenas that have been checked for lighting. We pick
          from that list — never from wherever you happen to be standing.
        </Text>

        {state.status === 'locating' || state.status === 'searching' ? (
          <View style={styles.stateCard}>
            <ActivityIndicator color={colors.ink} />
            <Text style={styles.stateText}>
              {state.status === 'locating'
                ? 'Getting your location…'
                : 'Looking for approved places nearby…'}
            </Text>
          </View>
        ) : null}

        {state.status === 'denied' ? (
          <View style={styles.stateCard}>
            <Ionicons name="location-outline" size={22} color={colors.ink} />
            <Text style={styles.stateText}>
              Quest needs your location to find an approved place near you. It
              is only used to pick a venue and place your target.
            </Text>
            <PrimaryButton
              label="Try again"
              variant="lime"
              onPress={() => void search()}
              style={styles.stateButton}
            />
          </View>
        ) : null}

        {state.status === 'empty' ? (
          <View style={styles.stateCard}>
            <Ionicons name="moon-outline" size={22} color={colors.ink} />
            <Text style={styles.stateText}>
              No approved place is open near you right now. That either means
              we have not verified anywhere here yet, or the nearby venues have
              closed for the evening. Quest will not send you somewhere
              unverified, so it stops here.
            </Text>
            <PrimaryButton
              label="Check again"
              variant="outline"
              onPress={() => void search()}
              style={styles.stateButton}
            />
          </View>
        ) : null}

        {state.status === 'error' ? (
          <View style={styles.stateCard}>
            <Ionicons name="alert-circle-outline" size={22} color={colors.danger} />
            <Text style={styles.stateText}>{state.message}</Text>
            <PrimaryButton
              label="Try again"
              variant="lime"
              onPress={() => void search()}
              style={styles.stateButton}
            />
          </View>
        ) : null}

        {state.status === 'ready'
          ? state.venues.map((venue) => (
              <VenueCard
                key={venue.id}
                venue={venue}
                busy={anchoringId === venue.id}
                onPress={() => void choose(venue)}
              />
            ))
          : null}
      </ScrollView>
    </View>
  );
}

function VenueCard({
  venue,
  busy,
  onPress,
}: {
  venue: QuestVenue;
  busy: boolean;
  onPress: () => void;
}) {
  const km = venue.distance_meters / 1000;
  const distance =
    venue.distance_meters < 1000
      ? `${Math.round(venue.distance_meters)} m away`
      : `${km.toFixed(1)} km away`;

  // The server already refuses to return a venue past its cutoff, so this is
  // informational rather than a gate — it exists so a player understands why
  // the list may be shorter later in the evening.
  const closes = venue.closes_at
    ? new Date(venue.closes_at).toLocaleTimeString(undefined, {
        hour: 'numeric',
        minute: '2-digit',
      })
    : null;

  return (
    <Pressable
      style={({ pressed }) => [styles.venueCard, pressed && styles.pressed]}
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
    >
      <View style={styles.venueTop}>
        <Text style={styles.venueName}>{venue.name}</Text>
        {busy ? <ActivityIndicator size="small" color={colors.ink} /> : null}
      </View>
      <Text style={styles.venueMeta}>
        {venueTypeLabel(venue.venue_type)} · {distance}
      </Text>
      <View style={styles.venueTags}>
        <Pill tone={venue.lighting === 'lit' ? 'lime' : 'light'} icon="bulb-outline">
          {venue.lighting === 'lit' ? 'LIT' : 'PARTLY LIT'}
        </Pill>
        {closes ? (
          <Pill tone="light" icon="time-outline">{`UNTIL ${closes}`}</Pill>
        ) : null}
      </View>
      {venue.verifying_authority ? (
        <Text style={styles.venueAuthority}>
          Verified by {venue.verifying_authority}
        </Text>
      ) : null}
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Chapter map + narration
// ---------------------------------------------------------------------------

const SLOT_LABELS: Record<LocationSlot, string> = {
  LOCAL_LANDMARK: 'Landmark',
  NEARBY_OPEN_SPACE: 'Open space',
  VISIBLE_SIGN_OR_COLOR: 'Sign or colour',
  SAFE_WALKING_DIRECTION: 'Which way',
  OBJECT_OR_SURFACE_TYPE: 'Surface',
};

/**
 * One Quest chapter: the story, the map with its red pin, and the slot
 * prompts.
 *
 * The placement is resolved exactly once and then persisted server-side, so
 * reopening the app mid-chapter returns the same pin rather than moving the
 * target. If the chapter already carries a placement from a previous session
 * we use it untouched and never roll a new one.
 */
export function QuestChapterScreen({
  membershipId,
  itemId,
  chapterNumber,
  totalChapters,
  title,
  storyText,
  narrationUrl,
  slots,
  venueLatitude,
  venueLongitude,
  playRadiusMeters,
  existingPlacement,
  onReadyToScan,
  onBack,
}: {
  membershipId: string;
  itemId: string;
  chapterNumber: number;
  totalChapters: number;
  title: string;
  storyText: string | null;
  narrationUrl: string | null;
  slots: LocationSlot[];
  venueLatitude: number;
  venueLongitude: number;
  playRadiusMeters: number;
  existingPlacement: Coordinate | null;
  onReadyToScan: () => void;
  onBack: () => void;
}) {
  const [placement, setPlacement] = useState<Coordinate | null>(existingPlacement);
  const [resolvedSlots, setResolvedSlots] = useState<
    Partial<Record<LocationSlot, string>>
  >({});
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const venue = useMemo(
    () => ({ latitude: venueLatitude, longitude: venueLongitude }),
    [venueLatitude, venueLongitude],
  );

  useEffect(() => {
    let active = true;

    async function place() {
      setPlacing(true);
      setError(null);
      try {
        let playerPosition: Coordinate | null = null;
        try {
          const fix = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          playerPosition = {
            latitude: fix.coords.latitude,
            longitude: fix.coords.longitude,
          };
        } catch {
          // A missing fix only costs the walking-direction slot, which
          // resolveSlots omits rather than guesses. Everything else still
          // works, so this is not worth failing the chapter over.
        }

        const candidate = placement ?? randomPlacementWithin(venue, playRadiusMeters);
        const slotValues = resolveSlots(slots, candidate, playerPosition);

        // First write wins server-side; if a placement already existed this
        // returns it and we adopt that instead of our freshly rolled one.
        const stored = await resolveChapterPlacement(
          membershipId,
          itemId,
          candidate.latitude,
          candidate.longitude,
          slotValues,
        );

        if (!active) return;
        const authoritative = {
          latitude: stored.latitude,
          longitude: stored.longitude,
        };
        setPlacement(authoritative);
        setResolvedSlots(
          stored.newly_placed
            ? slotValues
            : // Re-resolve against the stored pin so the walking direction
              // reflects where the player is standing now, not where they
              // stood when the chapter was first opened.
              resolveSlots(slots, authoritative, playerPosition),
        );
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : 'Could not place your target.');
        }
      } finally {
        if (active) setPlacing(false);
      }
    }

    void place();
    return () => {
      active = false;
    };
    // Intentionally keyed to the chapter only: re-running on every placement
    // change would roll a new target on each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [membershipId, itemId]);

  return (
    <View style={commonStyles.page}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <View style={styles.header}>
          <IconButton icon="chevron-back" onPress={onBack} />
          <SectionLabel>{`Chapter ${chapterNumber} of ${totalChapters}`}</SectionLabel>
        </View>

        <Text style={styles.title}>{title}</Text>

        {narrationUrl ? <NarrationBar url={narrationUrl} /> : null}

        {storyText ? <Text style={styles.story}>{storyText}</Text> : null}

        <QuestMapView
          venueLatitude={venueLatitude}
          venueLongitude={venueLongitude}
          playRadiusMeters={playRadiusMeters}
          pinLatitude={placement?.latitude ?? null}
          pinLongitude={placement?.longitude ?? null}
          style={styles.map}
        />

        {placing ? (
          <View style={styles.stateCard}>
            <ActivityIndicator color={colors.ink} />
            <Text style={styles.stateText}>Placing your target…</Text>
          </View>
        ) : null}

        {error ? (
          <View style={styles.stateCard}>
            <Ionicons name="alert-circle-outline" size={22} color={colors.danger} />
            <Text style={styles.stateText}>{error}</Text>
          </View>
        ) : null}

        {Object.keys(resolvedSlots).length > 0 ? (
          <View style={styles.slotList}>
            {(Object.keys(resolvedSlots) as LocationSlot[]).map((slot) => (
              <View key={slot} style={styles.slotRow}>
                <Text style={styles.slotLabel}>{SLOT_LABELS[slot]}</Text>
                <Text style={styles.slotValue}>{resolvedSlots[slot]}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <PrimaryButton
          label="I found it — scan"
          icon="qr-code-outline"
          variant="lime"
          onPress={onReadyToScan}
          disabled={!placement}
          style={styles.scanButton}
        />
      </ScrollView>
    </View>
  );
}

/**
 * Prerecorded chapter narration.
 *
 * Only the authored story prose is voiced. The slot text above is deliberately
 * not narrated: it differs per player and per venue, so no recording could
 * exist for it, and a synthetic voice reading it would break the narrator's
 * spell for the sake of a line the player can simply read.
 */
function NarrationBar({ url }: { url: string }) {
  const player = useAudioPlayer({ uri: url });
  const [playing, setPlaying] = useState(false);

  function toggle() {
    if (playing) {
      player.pause();
      setPlaying(false);
      return;
    }
    player.seekTo(0);
    player.play();
    setPlaying(true);
  }

  // No manual pause on unmount: useAudioPlayer releases the native player
  // itself, and calling pause() into a released object crashes on Android.
  // Same lesson as CelebrationScreen.

  return (
    <Pressable
      style={({ pressed }) => [styles.narrationBar, pressed && styles.pressed]}
      onPress={toggle}
      accessibilityRole="button"
    >
      <View style={styles.narrationIcon}>
        <Ionicons name={playing ? 'pause' : 'play'} size={18} color={colors.ink} />
      </View>
      <Text style={styles.narrationText}>
        {playing ? 'Playing narration' : 'Listen to this chapter'}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 18,
  },
  title: {
    color: colors.ink,
    fontSize: 30,
    lineHeight: 33,
    letterSpacing: -1.1,
    fontWeight: '900',
  },
  body: {
    marginTop: 10,
    marginBottom: 20,
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
  },
  story: {
    marginTop: 16,
    color: colors.ink,
    fontSize: 15,
    lineHeight: 24,
  },
  map: {
    height: 240,
    marginTop: 20,
  },
  stateCard: {
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: colors.sand,
    borderRadius: radii.lg,
    padding: 18,
    marginTop: 16,
  },
  stateText: {
    color: colors.ink,
    fontSize: 14,
    lineHeight: 21,
  },
  stateButton: {
    marginTop: 4,
    alignSelf: 'stretch',
  },
  venueCard: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 16,
    marginTop: 12,
  },
  venueTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  venueName: {
    flex: 1,
    color: colors.ink,
    fontSize: 17,
    fontWeight: '900',
  },
  venueMeta: {
    marginTop: 4,
    color: colors.muted,
    fontSize: 13,
  },
  venueTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 12,
  },
  venueAuthority: {
    marginTop: 10,
    color: colors.muted,
    fontSize: 11,
    lineHeight: 16,
  },
  slotList: {
    marginTop: 20,
    gap: 12,
  },
  slotRow: {
    borderLeftWidth: 3,
    borderLeftColor: colors.lime,
    paddingLeft: 12,
  },
  slotLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  slotValue: {
    marginTop: 3,
    color: colors.ink,
    fontSize: 14,
    lineHeight: 20,
  },
  narrationBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.ink,
    borderRadius: radii.pill,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 18,
    alignSelf: 'flex-start',
  },
  narrationIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.lime,
  },
  narrationText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '800',
    paddingRight: 8,
  },
  scanButton: {
    marginTop: 26,
  },
  pressed: {
    opacity: 0.85,
  },
});
