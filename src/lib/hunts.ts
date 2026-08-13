import { supabase } from './supabase';
import type { ClueKind, HuntFormat, HuntTier } from '../types';

export type JoinHuntResult = {
  membership_id: string;
  hunt_id: string;
  hunt_name: string;
  tier: HuntTier;
  format: HuntFormat;
  total_items: number;
  completed_at: string | null;
};

export async function joinHunt(
  joinCode: string,
  teamName?: string,
): Promise<JoinHuntResult> {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase.rpc('join_hunt', {
    p_join_code: joinCode,
    p_team_name: teamName ?? null,
  });
  if (error) throw new Error(error.message);
  return data as JoinHuntResult;
}

export type RemoteHuntItem = {
  id: string;
  hunt_id: string;
  membership_id: string;
  position: number;
  title: string;
  clue_text: string;
  hint_text: string | null;
  kind: ClueKind;
  media_path: string | null;
  latitude: number | null;
  longitude: number | null;
  activation_radius_meters: number | null;
  ar_asset_path: string | null;
  ar_asset_version: string | null;
  ar_altitude_mode: 'wgs84' | 'terrain' | 'rooftop' | null;
  ar_heading_degrees: number | null;
  completed: boolean;
  completed_at: string | null;
};

export async function fetchCurrentItems(): Promise<RemoteHuntItem[]> {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase
    .from('my_current_items')
    .select('*')
    .order('position', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as RemoteHuntItem[];
}

export type ScanReward = {
  title: string;
  terms: string | null;
  redemption_code: string | null;
  already_issued: boolean;
};

export type SubmitScanResult = {
  newly_completed: boolean;
  item_id: string;
  position: number;
  completed_count: number;
  total_items: number;
  hunt_complete: boolean;
  reward?: ScanReward;
};

export async function submitScan(
  membershipId: string,
  rawToken: string,
): Promise<SubmitScanResult> {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase.rpc('submit_scan', {
    p_membership_id: membershipId,
    p_raw_token: rawToken,
  });
  if (error) throw new Error(error.message);
  return data as SubmitScanResult;
}
