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
  verifying_authority: string | null;
  distance_meters: number;
};

/**
 * Verified venues near a coordinate, nearest first. Returns an empty list
 * where the registry has no coverage yet — that is a normal state, not an
 * error, and the caller should tell the player Quest isn't available in
 * their area rather than falling back to an unvetted location.
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

const venueTypeLabels: Record<VenueType, string> = {
  public_park: 'Public park',
  municipal_trail: 'Municipal trail',
  city_soccer_field: 'City soccer field',
  public_outdoor_arena: 'Public outdoor arena',
};

export function venueTypeLabel(type: VenueType): string {
  return venueTypeLabels[type];
}
