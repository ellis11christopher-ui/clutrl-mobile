import type { LocationSlot } from '../types';

// Placement and slot resolution for CLU/TRL Quest.
//
// WHAT THIS DOES AND DOES NOT DO
// ---------------------------------------------------------------------------
// Only one of the five slots can currently be resolved to a real fact about
// the world: SAFE_WALKING_DIRECTION, which is computed from the bearing
// between the player and the target. It is also the only one that is safe to
// state as a fact, and it is only safe because the target is guaranteed to be
// inside a vetted venue — the direction never points off the grounds.
//
// The other four describe things a phone cannot currently identify.
// OBJECT_OR_SURFACE_TYPE needs AR plane classification, which the mock AR
// screen does not have. LOCAL_LANDMARK and NEARBY_OPEN_SPACE would need a
// places API. VISIBLE_SIGN_OR_COLOR needs live camera vision and is the least
// reliable of all. So rather than fabricate a landmark that may not exist,
// they resolve to prompts that hand the recognition back to the player, who
// is standing there and can actually see the place.
//
// That degrades honestly: when real AR and places data arrive, these
// functions can start returning identified objects and the calling screens do
// not have to change.

const EARTH_RADIUS_M = 6371000;

export type Coordinate = { latitude: number; longitude: number };

export function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function toDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}

/** Great-circle distance in meters. Mirrors haversine_meters in the schema. */
export function distanceMeters(from: Coordinate, to: Coordinate): number {
  const dLat = toRadians(to.latitude - from.latitude);
  const dLng = toRadians(to.longitude - from.longitude);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(from.latitude)) *
      Math.cos(toRadians(to.latitude)) *
      Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Initial bearing in degrees clockwise from true north. */
export function bearingDegrees(from: Coordinate, to: Coordinate): number {
  const lat1 = toRadians(from.latitude);
  const lat2 = toRadians(to.latitude);
  const dLng = toRadians(to.longitude - from.longitude);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (toDegrees(Math.atan2(y, x)) + 360) % 360;
}

const COMPASS_POINTS = [
  'north',
  'northeast',
  'east',
  'southeast',
  'south',
  'southwest',
  'west',
  'northwest',
] as const;

export function compassDirection(bearing: number): string {
  // 8 sectors of 45 degrees, offset so each label is centred on its bearing.
  const index = Math.round(((bearing % 360) + 360) % 360 / 45) % 8;
  return COMPASS_POINTS[index]!;
}

/**
 * A random point inside the venue's playable area.
 *
 * Kept to 80% of the radius so a GPS error of a few meters cannot put the
 * target outside the vetted grounds — the server rejects out-of-radius
 * placements outright, and a target hugging the boundary is also more likely
 * to sit in a hedge or a car park than somewhere a player can stand.
 *
 * sqrt() on the radius is what makes the distribution uniform over the disc;
 * without it, points bunch toward the centre.
 */
export function randomPlacementWithin(
  venue: Coordinate,
  playRadiusMeters: number,
): Coordinate {
  const usableRadius = playRadiusMeters * 0.8;
  const distance = usableRadius * Math.sqrt(Math.random());
  const bearing = Math.random() * 360;

  const angular = distance / EARTH_RADIUS_M;
  const lat1 = toRadians(venue.latitude);
  const lng1 = toRadians(venue.longitude);
  const brg = toRadians(bearing);

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angular) +
      Math.cos(lat1) * Math.sin(angular) * Math.cos(brg),
  );
  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(brg) * Math.sin(angular) * Math.cos(lat1),
      Math.cos(angular) - Math.sin(lat1) * Math.sin(lat2),
    );

  return { latitude: toDegrees(lat2), longitude: toDegrees(lng2) };
}

// Prompts for the slots a phone cannot resolve on its own. Phrased as things
// to look for rather than claims about what is there, since the app genuinely
// does not know.
const SLOT_PROMPTS: Record<Exclude<LocationSlot, 'SAFE_WALKING_DIRECTION'>, string> = {
  LOCAL_LANDMARK:
    'Find the most recognisable thing near the pin — a statue, fountain, bandshell, or big tree.',
  NEARBY_OPEN_SPACE:
    'Look for the open ground closest to the pin, clear of benches and paths.',
  VISIBLE_SIGN_OR_COLOR:
    'Spot a sign or a splash of colour you can see from where the pin sits.',
  OBJECT_OR_SURFACE_TYPE:
    'Pick a flat surface at the pin — a path, a bench seat, a step, or level grass.',
};

/**
 * Resolve a chapter's slots for this player.
 *
 * `playerPosition` is optional because a player may open a chapter before
 * their GPS has settled; without it the walking-direction slot is simply
 * omitted rather than guessed.
 */
export function resolveSlots(
  slots: LocationSlot[],
  placement: Coordinate,
  playerPosition?: Coordinate | null,
): Partial<Record<LocationSlot, string>> {
  const resolved: Partial<Record<LocationSlot, string>> = {};

  for (const slot of slots) {
    if (slot === 'SAFE_WALKING_DIRECTION') {
      if (!playerPosition) continue;
      const metres = Math.round(distanceMeters(playerPosition, placement));
      const direction = compassDirection(bearingDegrees(playerPosition, placement));
      resolved[slot] =
        metres <= 10
          ? 'You are practically on top of it — look around you.'
          : `Head ${direction}, about ${metres} m, staying inside the park.`;
      continue;
    }
    resolved[slot] = SLOT_PROMPTS[slot];
  }

  return resolved;
}
