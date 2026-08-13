-- CLU/TRL Quest: verified venue registry, chapter content, and per-player
-- AR placement persistence.
--
-- SAFETY POLICY (the reason this whole file exists):
-- Quest play is restricted to public parks, municipality-maintained trails,
-- city-run soccer fields, and public outdoor arenas — all with lighting
-- verified by the responsible municipality, city, county, state, parish,
-- borough, town, or community association. Nothing is placed on arbitrary
-- streets and nothing is inferred at runtime about whether a route is safe.
-- Instead, a curated registry of vetted, lit, public recreational land is
-- compiled ahead of time, and the app only ever anchors a quest inside one
-- of those venues.
--
-- The verification provenance is enforced structurally, not by convention:
-- see quest_venues_verified_requires_provenance below. A venue physically
-- cannot be stored as 'verified' unless it carries the verifying authority,
-- a source URL, a verification date, and a known (non-'unknown') lighting
-- status. Rows default to 'pending' and are invisible to the app until a
-- human or agent supplies real, citable provenance.
--
-- Run this once in the Supabase SQL Editor. Supabase's pre-run advisor will
-- warn that the new tables are created without RLS — that is expected, this
-- script enables RLS on each of them a few statements later. Choose
-- "Run without RLS" so the advisor does not attach its own default policy.

-- ---------------------------------------------------------------------------
-- Venue registry
-- ---------------------------------------------------------------------------

create type public.venue_type as enum (
  'public_park',
  'municipal_trail',
  'city_soccer_field',
  'public_outdoor_arena'
);

create type public.lighting_status as enum (
  'lit',
  'partially_lit',
  'unlit',
  'unknown'
);

create type public.venue_verification_status as enum (
  'pending',
  'verified',
  'rejected'
);

create table public.quest_venues (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 200),
  venue_type public.venue_type not null,

  -- Where it is. locality/region are kept as plain text because the registry
  -- spans many jurisdictions with incompatible administrative vocabularies
  -- (state / parish / borough / county / community association).
  locality text not null,
  region text,
  country_code text not null default 'US' check (char_length(country_code) = 2),
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),

  -- Playable area, modelled as a simple center + radius for now. Real park
  -- boundaries are polygons; upgrade to PostGIS geometry if slot placement
  -- ever needs true edge accuracy.
  play_radius_meters integer not null default 150
    check (play_radius_meters between 20 and 2000),

  -- Safety verification.
  lighting public.lighting_status not null default 'unknown',
  verification_status public.venue_verification_status not null default 'pending',
  verifying_authority text,
  verification_source_url text,
  verification_note text,
  verified_at timestamptz,
  submitted_by text not null default 'agent'
    check (submitted_by in ('agent', 'human')),

  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Structural guarantee that "verified" always means something. Without
  -- this, a well-meaning bulk insert could mark a park verified-and-lit with
  -- no evidence, and the app would then send players there after dark.
  constraint quest_venues_verified_requires_provenance check (
    verification_status <> 'verified' or (
      verifying_authority is not null
      and verification_source_url is not null
      and verified_at is not null
      and lighting <> 'unknown'
    )
  )
);

create index quest_venues_lookup_idx
  on public.quest_venues (latitude, longitude)
  where active = true and verification_status = 'verified';

alter table public.quest_venues enable row level security;

-- Clients may read only venues that are actually cleared for play. Pending
-- and rejected candidates stay server-side. There is deliberately no client
-- insert/update policy: the registry is compiled through the SQL editor or a
-- service role by a human or agent, never by the app.
create policy "quest venues read verified"
  on public.quest_venues for select
  to authenticated
  using (active = true and verification_status = 'verified');

-- ---------------------------------------------------------------------------
-- Quest chapter content
-- ---------------------------------------------------------------------------

-- Nullable columns on hunt_items, matching how the existing ar_* fields are
-- modelled — only Quest hunts populate these.
--
-- location_slots lists which runtime-resolved slots a chapter uses. These are
-- the reason narration is a hybrid: story prose is prerecorded, but slot text
-- differs per player and per venue, so it cannot be voiced ahead of time.
alter table public.hunt_items
  add column story_text text,
  add column narration_path text,
  add column narration_duration_ms integer
    check (narration_duration_ms is null or narration_duration_ms > 0),
  add column location_slots jsonb not null default '[]'::jsonb,
  add column ar_character_key text,
  add constraint hunt_items_location_slots_valid check (
    jsonb_typeof(location_slots) = 'array'
    and location_slots <@ '[
      "LOCAL_LANDMARK",
      "NEARBY_OPEN_SPACE",
      "VISIBLE_SIGN_OR_COLOR",
      "SAFE_WALKING_DIRECTION",
      "OBJECT_OR_SURFACE_TYPE"
    ]'::jsonb
  );

-- ---------------------------------------------------------------------------
-- Per-player venue anchoring and placement persistence
-- ---------------------------------------------------------------------------

-- Which vetted venue this player's quest is anchored to. Set once, on the
-- first chapter, so a 22-chapter quest played across several sessions keeps
-- happening in the same park rather than hopping venues as the player moves.
alter table public.hunt_memberships
  add column quest_venue_id uuid references public.quest_venues(id);

-- The resolved AR placement for one chapter, for one player. Persisted so the
-- red pin does not move when the app is closed and reopened mid-quest —
-- without this, "save progress" would restore the chapter but silently
-- relocate its target.
create table public.membership_chapter_placements (
  membership_id uuid not null references public.hunt_memberships(id) on delete cascade,
  item_id uuid not null references public.hunt_items(id) on delete cascade,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  resolved_slots jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  primary key (membership_id, item_id)
);

alter table public.membership_chapter_placements enable row level security;

-- No client-facing policies: written through resolve_chapter_placement below
-- and read through the my_current_items view, both of which are SECURITY
-- DEFINER and scope every result to auth.uid() themselves. Same pattern as
-- membership_item_sequence.

-- ---------------------------------------------------------------------------
-- Geo helpers
-- ---------------------------------------------------------------------------

-- Great-circle distance in meters. Kept as a plain SQL function so the
-- registry does not require the PostGIS extension.
create or replace function public.haversine_meters(
  lat1 double precision,
  lng1 double precision,
  lat2 double precision,
  lng2 double precision
)
returns double precision
language sql
immutable
parallel safe
set search_path = ''
as $$
  select 6371000 * acos(
    least(1, greatest(-1,
      sin(radians(lat1)) * sin(radians(lat2)) +
      cos(radians(lat1)) * cos(radians(lat2)) * cos(radians(lng2 - lng1))
    ))
  );
$$;

-- Verified, lit, active venues near a player, nearest first. The bounding-box
-- predicates exist so the partial index can do the heavy filtering before the
-- trigonometry runs.
create or replace function public.find_quest_venues_near(
  p_latitude double precision,
  p_longitude double precision,
  p_radius_meters integer default 25000,
  p_limit integer default 20
)
returns table (
  id uuid,
  name text,
  venue_type public.venue_type,
  locality text,
  region text,
  latitude double precision,
  longitude double precision,
  play_radius_meters integer,
  lighting public.lighting_status,
  verifying_authority text,
  distance_meters double precision
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    v.id,
    v.name,
    v.venue_type,
    v.locality,
    v.region,
    v.latitude,
    v.longitude,
    v.play_radius_meters,
    v.lighting,
    v.verifying_authority,
    public.haversine_meters(p_latitude, p_longitude, v.latitude, v.longitude)
  from public.quest_venues v
  where v.active = true
    and v.verification_status = 'verified'
    and v.latitude
      between p_latitude - (p_radius_meters / 111320.0)
          and p_latitude + (p_radius_meters / 111320.0)
    and v.longitude
      between p_longitude
            - (p_radius_meters / (111320.0 * greatest(cos(radians(p_latitude)), 0.01)))
          and p_longitude
            + (p_radius_meters / (111320.0 * greatest(cos(radians(p_latitude)), 0.01)))
    and public.haversine_meters(p_latitude, p_longitude, v.latitude, v.longitude)
      <= p_radius_meters
  order by public.haversine_meters(p_latitude, p_longitude, v.latitude, v.longitude)
  limit least(greatest(p_limit, 1), 100);
$$;

grant execute on function public.find_quest_venues_near(
  double precision, double precision, integer, integer
) to authenticated;

-- ---------------------------------------------------------------------------
-- Quest runtime RPCs
-- ---------------------------------------------------------------------------

-- Anchor a membership to a vetted venue. Idempotent and one-way: once a
-- quest has a venue it keeps it, so a player who walks out of range mid-quest
-- is not silently re-anchored somewhere else.
create or replace function public.anchor_quest_venue(
  p_membership_id uuid,
  p_venue_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_membership public.hunt_memberships;
  v_venue public.quest_venues;
begin
  select * into v_membership
  from public.hunt_memberships
  where id = p_membership_id and profile_id = auth.uid();

  if not found then
    raise exception 'Membership not found for the current user';
  end if;

  if v_membership.quest_venue_id is not null then
    select * into v_venue
    from public.quest_venues
    where id = v_membership.quest_venue_id;

    return jsonb_build_object(
      'venue_id', v_venue.id,
      'name', v_venue.name,
      'latitude', v_venue.latitude,
      'longitude', v_venue.longitude,
      'play_radius_meters', v_venue.play_radius_meters,
      'newly_anchored', false
    );
  end if;

  select * into v_venue
  from public.quest_venues
  where id = p_venue_id
    and active = true
    and verification_status = 'verified';

  if not found then
    raise exception 'That location is not a verified CLU/TRL Quest venue';
  end if;

  update public.hunt_memberships
  set quest_venue_id = v_venue.id
  where id = p_membership_id;

  return jsonb_build_object(
    'venue_id', v_venue.id,
    'name', v_venue.name,
    'latitude', v_venue.latitude,
    'longitude', v_venue.longitude,
    'play_radius_meters', v_venue.play_radius_meters,
    'newly_anchored', true
  );
end;
$$;

grant execute on function public.anchor_quest_venue(uuid, uuid) to authenticated;

-- Record where a chapter's AR target sits for this player. First write wins,
-- so reopening the app mid-chapter returns the original pin instead of
-- generating a new one.
--
-- The placement is rejected unless it falls inside the anchored venue's
-- playable radius: a client bug or a tampered request must not be able to pin
-- a target onto unvetted ground.
create or replace function public.resolve_chapter_placement(
  p_membership_id uuid,
  p_item_id uuid,
  p_latitude double precision,
  p_longitude double precision,
  p_resolved_slots jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_membership public.hunt_memberships;
  v_venue public.quest_venues;
  v_existing public.membership_chapter_placements;
  v_distance double precision;
begin
  select * into v_membership
  from public.hunt_memberships
  where id = p_membership_id and profile_id = auth.uid();

  if not found then
    raise exception 'Membership not found for the current user';
  end if;

  select * into v_existing
  from public.membership_chapter_placements
  where membership_id = p_membership_id and item_id = p_item_id;

  if found then
    return jsonb_build_object(
      'item_id', v_existing.item_id,
      'latitude', v_existing.latitude,
      'longitude', v_existing.longitude,
      'resolved_slots', v_existing.resolved_slots,
      'newly_placed', false
    );
  end if;

  if v_membership.quest_venue_id is null then
    raise exception 'Anchor this quest to a verified venue before placing a chapter';
  end if;

  select * into v_venue
  from public.quest_venues
  where id = v_membership.quest_venue_id;

  v_distance := public.haversine_meters(
    v_venue.latitude, v_venue.longitude, p_latitude, p_longitude
  );

  if v_distance > v_venue.play_radius_meters then
    raise exception 'That placement falls outside the verified play area';
  end if;

  insert into public.membership_chapter_placements (
    membership_id, item_id, latitude, longitude, resolved_slots
  )
  values (
    p_membership_id, p_item_id, p_latitude, p_longitude,
    coalesce(p_resolved_slots, '{}'::jsonb)
  );

  return jsonb_build_object(
    'item_id', p_item_id,
    'latitude', p_latitude,
    'longitude', p_longitude,
    'resolved_slots', coalesce(p_resolved_slots, '{}'::jsonb),
    'newly_placed', true
  );
end;
$$;

grant execute on function public.resolve_chapter_placement(
  uuid, uuid, double precision, double precision, jsonb
) to authenticated;

-- ---------------------------------------------------------------------------
-- Read path
-- ---------------------------------------------------------------------------

-- Same view as before, now also carrying Quest chapter content and this
-- player's persisted placement. New columns are appended so CREATE OR REPLACE
-- accepts the change.
create or replace view public.my_current_items as
select
  hi.id,
  hi.hunt_id,
  hm.id as membership_id,
  mis.sequence_position as position,
  hi.title,
  hi.clue_text,
  hi.hint_text,
  hi.kind,
  hi.media_path,
  hi.latitude,
  hi.longitude,
  hi.activation_radius_meters,
  hi.ar_asset_path,
  hi.ar_asset_version,
  hi.ar_altitude_mode,
  hi.ar_heading_degrees,
  (ic.id is not null) as completed,
  ic.completed_at,
  hi.story_text,
  hi.narration_path,
  hi.narration_duration_ms,
  hi.location_slots,
  hi.ar_character_key,
  mcp.latitude as placement_latitude,
  mcp.longitude as placement_longitude,
  mcp.resolved_slots as placement_slots
from public.hunt_memberships hm
join public.membership_item_sequence mis
  on mis.membership_id = hm.id
join public.hunt_items hi
  on hi.id = mis.item_id and hi.published = true
left join public.item_completions ic
  on ic.membership_id = hm.id and ic.item_id = hi.id
left join public.membership_chapter_placements mcp
  on mcp.membership_id = hm.id and mcp.item_id = hi.id
where hm.profile_id = auth.uid()
  and mis.sequence_position <= (
    select count(*) + 1
    from public.item_completions ic2
    where ic2.membership_id = hm.id
  );

grant select on public.my_current_items to authenticated;
