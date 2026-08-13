import { supabase } from './supabase';
import type { LightingStatus, LocationSlot, VenueType } from '../types';

// CLU/TRL Quest venue registry client.
//
// Quest play is restricted to public parks, municipality-maintained trails,
// city-run soccer fields, and public outdoor arenas, all with lighting
// verified by the responsible authority. The server only ever returns venues
// that carry real verification provenance (see the
// quest_venues_verified_requires_provenance constraint in
// supabase/schema.sql), so the app never has to decide for itself whether
// somewhere is safe to send a player.

export type QuestVenue = {
  id: string;
  name: string;
  venue_type: VenueType;
  locality: string;
  region: string | null;
  latitude: number;
  longitude: number;
  play_radius_meters: number;
  lighting: LightingStatus;
  // True when the venue's lights only come on for a paid booking, so it
  // cannot be relied on to be lit for a walk-up player. Such venues always
  // carry a playable_until_local cutoff, past which the server stops
  // returning them at all.
  lighting_requires_reservation: boolean;
  playable_until_local: string | null;
  sunset_buffer_minutes: number | null;
  /**
   * When this venue stops being offered tonight, as an absolute timestamp
   * computed from local sunset minus its buffer. Null when the venue has no
   * sunset rule. Surfaced so the app can say "until 7:42 PM" rather than
   * letting the venue silently vanish from the list later on.
   */
  closes_at: string | null;
  time_zone: string;
  verifying_authority: string | null;
  distance_meters: number;
};

/**
 * Verified venues near a coordinate, nearest first.
 *
 * The server also filters by each venue's own local playable window, so a
 * reservation-lit field simply stops appearing after its evening cutoff.
 * That means an empty list is a normal state with two distinct causes — no
 * registry coverage in this area, or everything nearby is closed for the
 * evening — and in neither case should the caller fall back to an unvetted
 * location.
 */
export async function findVenuesNear(
  latitude: number,
  longitude: number,
  radiusMeters = 25000,
  limit = 20,
): Promise<QuestVenue[]> {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase.rpc('find_quest_venues_near', {
    p_latitude: latitude,
    p_longitude: longitude,
    p_radius_meters: radiusMeters,
    p_limit: limit,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as QuestVenue[];
}

export type AnchoredVenue = {
  venue_id: string;
  name: string;
  latitude: number;
  longitude: number;
  play_radius_meters: number;
  newly_anchored: boolean;
};

/**
 * Pin this membership's quest to one vetted venue. Idempotent and one-way:
 * calling it again returns the venue the quest is already anchored to, so a
 * player who wanders mid-quest is never silently relocated.
 */
export async function anchorQuestVenue(
  membershipId: string,
  venueId: string,
): Promise<AnchoredVenue> {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase.rpc('anchor_quest_venue', {
    p_membership_id: membershipId,
    p_venue_id: venueId,
  });
  if (error) throw new Error(error.message);
  return data as AnchoredVenue;
}

export type ChapterPlacement = {
  item_id: string;
  latitude: number;
  longitude: number;
  resolved_slots: Partial<Record<LocationSlot, string>>;
  newly_placed: boolean;
};

/**
 * Fix where a chapter's AR target sits for this player. First write wins, so
 * closing and reopening the app mid-chapter returns the original pin rather
 * than moving it. The server rejects placements outside the anchored venue's
 * playable radius.
 */
export async function resolveChapterPlacement(
  membershipId: string,
  itemId: string,
  latitude: number,
  longitude: number,
  resolvedSlots: Partial<Record<LocationSlot, string>> = {},
): Promise<ChapterPlacement> {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase.rpc('resolve_chapter_placement', {
    p_membership_id: membershipId,
    p_item_id: itemId,
    p_latitude: latitude,
    p_longitude: longitude,
    p_resolved_slots: resolvedSlots,
  });
  if (error) throw new Error(error.message);
  return data as ChapterPlacement;
}

/**
 * Public URL for a chapter's prerecorded narration.
 *
 * Narration is stored in a Supabase Storage bucket rather than bundled: 22
 * chapters of voice would bloat the app download for players who only ever
 * run one Quest. Returns null when a chapter has no recording yet, which is
 * the normal state while stories are still being written — the chapter falls
 * back to on-screen story text.
 */
export function narrationUrl(narrationPath: string | null): string | null {
  if (!narrationPath || !supabase) return null;
  const { data } = supabase.storage
    .from('quest-narration')
    .getPublicUrl(narrationPath);
  return data.publicUrl ?? null;
}

const venueTypeLabels: Record<VenueType, string> = {
  public_park: 'Public park',
  municipal_trail: 'Municipal trail',
  city_soccer_field: 'City soccer field',
  public_outdoor_arena: 'Public outdoor arena',
};

export function venueTypeLabel(type: VenueType): string {
  return venueTypeLabels[type];
}
