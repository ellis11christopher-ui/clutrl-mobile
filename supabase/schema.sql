-- CLUTRL production-oriented starter schema.
-- Apply only after reviewing authentication, billing, retention, and RLS needs.

-- Pinned to a known schema (rather than left to install into "public") so
-- that SECURITY DEFINER functions below can call it explicitly even when
-- they run with "set search_path = ''".
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create type public.hunt_tier as enum ('base', 'live', 'immersive');
create type public.hunt_status as enum ('draft', 'scheduled', 'live', 'paused', 'closed');
create type public.clue_kind as enum ('text', 'photo', 'video', 'ar');
create type public.member_role as enum ('hunter', 'master');

-- The CLU/TRL sub-brand / game mode a hunt plays as. Orthogonal to hunt_tier
-- (which gates platform features like GPS tracking and chat) — format
-- decides the actual game mechanic. Note hunt_tier also has a 'live' label;
-- that's an unrelated coincidence (tier 'live' = realtime features unlocked,
-- format 'live' = the short single-venue event sub-brand), Postgres enum
-- labels are scoped per type so there's no collision, but don't conflate them
-- when reading query results.
--   pista       - CLU/TRL Pista: checkpoint/location clue trails, fixed
--                 shared order (hunt_items.position), same for every hunter.
--   hare_hounds - CLU/TRL Hare & Hounds: live team pursuit, each hunter gets
--                 their own randomized order so they can't just tail others.
--   quest       - CLU/TRL Quest: story-driven adventures. Same fixed shared
--                 order as pista; each item is framed as the next chapter.
--   ar          - CLU/TRL AR: augmented-reality hunts. Randomized order like
--                 hare_hounds; every published item must be kind = 'ar'.
--   live        - CLU/TRL Live: festivals/conferences/community events, one
--                 venue, a short window (starts_at/ends_at). Randomized order
--                 like hare_hounds, since dense short-window crowds are
--                 exactly where following-the-crowd is worst.
create type public.hunt_format as enum ('pista', 'hare_hounds', 'quest', 'ar', 'live');

-- CLU/TRL Quest venue registry vocabulary. Quest play is restricted to
-- public parks, municipality-maintained trails, city-run soccer fields, and
-- public outdoor arenas, all with municipally verified lighting — see
-- quest_venues below for the full policy and the provenance guarantee.
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

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 80),
  created_at timestamptz not null default now()
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  owner_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'editor', 'operator')),
  created_at timestamptz not null default now(),
  primary key (organization_id, profile_id)
);

-- CLU/TRL Quest venue registry.
--
-- SAFETY POLICY: Quest play is restricted to public parks, municipality-
-- maintained trails, city-run soccer fields, and public outdoor arenas — all
-- with lighting verified by the responsible municipality, city, county,
-- state, parish, borough, town, or community association. Nothing is placed
-- on arbitrary streets and nothing is inferred at runtime about whether a
-- route is safe; the app only ever anchors a quest inside a vetted venue.
--
-- The provenance is enforced structurally rather than by convention: the
-- constraint below makes it impossible to store a venue as 'verified'
-- without a verifying authority, a source URL, a verification date, and a
-- known lighting status. Rows default to 'pending' and stay invisible to the
-- app until real, citable evidence is supplied.
create table public.quest_venues (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 200),
  venue_type public.venue_type not null,

  -- locality/region are plain text because the registry spans jurisdictions
  -- with incompatible administrative vocabularies (state / parish / borough /
  -- county / community association).
  locality text not null,
  region text,
  country_code text not null default 'US' check (char_length(country_code) = 2),
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),

  -- Playable area as center + radius. Real park boundaries are polygons;
  -- upgrade to PostGIS if slot placement ever needs true edge accuracy.
  play_radius_meters integer not null default 150
    check (play_radius_meters between 20 and 2000),

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

create table public.hunts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 140),
  join_code text not null,
  tier public.hunt_tier not null default 'base',
  format public.hunt_format not null default 'pista',
  status public.hunt_status not null default 'draft',
  starts_at timestamptz,
  ends_at timestamptz,
  location_retention_until timestamptz,
  reward_title text,
  reward_copy text,
  reward_terms text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (join_code),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);

create table public.hunt_items (
  id uuid primary key default gen_random_uuid(),
  hunt_id uuid not null references public.hunts(id) on delete cascade,
  position integer not null check (position > 0),
  title text not null,
  clue_text text not null,
  hint_text text,
  kind public.clue_kind not null,
  media_path text,
  qr_token_hash text not null,
  latitude double precision,
  longitude double precision,
  activation_radius_meters integer check (activation_radius_meters between 1 and 10000),
  ar_asset_path text,
  ar_asset_version text,
  ar_altitude_mode text check (ar_altitude_mode in ('wgs84', 'terrain', 'rooftop')),
  ar_heading_degrees double precision check (
    ar_heading_degrees is null or
    (ar_heading_degrees >= 0 and ar_heading_degrees < 360)
  ),

  -- CLU/TRL Quest chapter content. Only Quest hunts populate these, matching
  -- how the ar_* fields above are modelled.
  --
  -- location_slots lists which runtime-resolved slots a chapter uses. These
  -- are why narration is a hybrid: story prose is prerecorded, but slot text
  -- differs per player and per venue, so it cannot be voiced ahead of time.
  story_text text,
  narration_path text,
  narration_duration_ms integer
    check (narration_duration_ms is null or narration_duration_ms > 0),
  location_slots jsonb not null default '[]'::jsonb,
  ar_character_key text,

  published boolean not null default false,
  created_at timestamptz not null default now(),
  unique (hunt_id, position),
  unique (hunt_id, qr_token_hash),
  constraint hunt_items_location_slots_valid check (
    jsonb_typeof(location_slots) = 'array'
    and location_slots <@ '[
      "LOCAL_LANDMARK",
      "NEARBY_OPEN_SPACE",
      "VISIBLE_SIGN_OR_COLOR",
      "SAFE_WALKING_DIRECTION",
      "OBJECT_OR_SURFACE_TYPE"
    ]'::jsonb
  ),
  check (
    kind <> 'ar' or
    (latitude is not null and longitude is not null and ar_asset_path is not null)
  )
);

create table public.hunt_memberships (
  id uuid primary key default gen_random_uuid(),
  hunt_id uuid not null references public.hunts(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role public.member_role not null default 'hunter',
  team_name text,
  location_consent_at timestamptz,
  location_sharing_stopped_at timestamptz,
  joined_at timestamptz not null default now(),
  completed_at timestamptz,
  -- Which vetted venue a Quest is anchored to. Set once, on the first
  -- chapter, so a 22-chapter quest played across several sessions keeps
  -- happening in the same park rather than hopping venues as the player moves.
  quest_venue_id uuid references public.quest_venues(id),
  unique (hunt_id, profile_id)
);

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

-- Each hunter gets their own shuffled visiting order over the same set of
-- targets, generated once at join time (see join_hunt). This is what stops
-- hunters from just following each other to the same next target — everyone
-- still finds all of them, just not in the same order or at the same time.
create table public.membership_item_sequence (
  membership_id uuid not null references public.hunt_memberships(id) on delete cascade,
  item_id uuid not null references public.hunt_items(id) on delete cascade,
  sequence_position integer not null check (sequence_position > 0),
  primary key (membership_id, item_id),
  unique (membership_id, sequence_position)
);

alter table public.membership_item_sequence enable row level security;

-- No client-facing policies, by design: only join_hunt/submit_scan and the
-- my_current_items view (all SECURITY DEFINER / bypass RLS) touch this table,
-- same pattern as hunt_items and item_completions above.

create table public.item_completions (
  id uuid primary key default gen_random_uuid(),
  membership_id uuid not null references public.hunt_memberships(id) on delete cascade,
  item_id uuid not null references public.hunt_items(id) on delete cascade,
  completed_at timestamptz not null default now(),
  verification_method text not null default 'qr' check (
    verification_method in ('qr', 'master_override')
  ),
  attempt_count integer not null default 1 check (attempt_count > 0),
  unique (membership_id, item_id)
);

create table public.location_pings (
  id bigint generated always as identity primary key,
  membership_id uuid not null references public.hunt_memberships(id) on delete cascade,
  recorded_at timestamptz not null default now(),
  latitude double precision not null,
  longitude double precision not null,
  accuracy_meters double precision,
  heading_degrees double precision,
  speed_mps double precision
);

create index location_pings_membership_recorded_idx
  on public.location_pings (membership_id, recorded_at desc);

create table public.help_threads (
  id uuid primary key default gen_random_uuid(),
  membership_id uuid not null references public.hunt_memberships(id) on delete cascade,
  item_id uuid references public.hunt_items(id) on delete set null,
  closed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.help_messages (
  id bigint generated always as identity primary key,
  thread_id uuid not null references public.help_threads(id) on delete cascade,
  sender_id uuid not null references public.profiles(id),
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);

create table public.sponsor_placements (
  id uuid primary key default gen_random_uuid(),
  hunt_id uuid not null references public.hunts(id) on delete cascade,
  sponsor_name text not null,
  moment text not null check (moment in ('before_clue', 'after_find')),
  headline text not null,
  body text,
  media_path text,
  destination_url text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.sponsor_impressions (
  id bigint generated always as identity primary key,
  placement_id uuid not null references public.sponsor_placements(id) on delete cascade,
  membership_id uuid not null references public.hunt_memberships(id) on delete cascade,
  item_id uuid references public.hunt_items(id) on delete set null,
  visible_milliseconds integer check (visible_milliseconds >= 0),
  created_at timestamptz not null default now()
);

create table public.rewards (
  id uuid primary key default gen_random_uuid(),
  hunt_id uuid not null references public.hunts(id) on delete cascade,
  title text not null,
  terms text,
  inventory integer check (inventory is null or inventory >= 0),
  created_at timestamptz not null default now()
);

create table public.reward_redemptions (
  id uuid primary key default gen_random_uuid(),
  reward_id uuid not null references public.rewards(id) on delete cascade,
  membership_id uuid not null references public.hunt_memberships(id) on delete cascade,
  redemption_token_hash text not null unique,
  issued_at timestamptz not null default now(),
  redeemed_at timestamptz,
  unique (reward_id, membership_id)
);

-- Publishing invariants: at least 10 active/published items, and (for the
-- CLU/TRL AR format) every one of those items must actually be an AR
-- discovery — an AR-format hunt with a text/photo/video item in the mix
-- would silently break the "entire treasure is in AR" promise.
create or replace function public.assert_hunt_publishable(target_hunt_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_format public.hunt_format;
  published_count integer;
  non_ar_count integer;
begin
  select format into v_format
  from public.hunts
  where id = target_hunt_id;

  select count(*)
  into published_count
  from public.hunt_items
  where hunt_id = target_hunt_id and published = true;

  if published_count < 10 then
    raise exception 'A published hunt requires at least 10 active items';
  end if;

  if v_format = 'ar' then
    select count(*)
    into non_ar_count
    from public.hunt_items
    where hunt_id = target_hunt_id and published = true and kind <> 'ar';

    if non_ar_count > 0 then
      raise exception 'A CLU/TRL AR hunt requires every published item to be an AR discovery';
    end if;
  end if;
end;
$$;

-- Starter RLS. Server-only verification and location-retention functions should
-- use a dedicated service role and must not be callable directly by clients.
alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.hunts enable row level security;
alter table public.hunt_items enable row level security;
alter table public.hunt_memberships enable row level security;
alter table public.item_completions enable row level security;
alter table public.location_pings enable row level security;
alter table public.help_threads enable row level security;
alter table public.help_messages enable row level security;
alter table public.sponsor_placements enable row level security;
alter table public.sponsor_impressions enable row level security;
alter table public.rewards enable row level security;
alter table public.reward_redemptions enable row level security;
alter table public.quest_venues enable row level security;
alter table public.membership_chapter_placements enable row level security;

-- Clients may read only venues actually cleared for play. Pending and
-- rejected candidates stay server-side. There is deliberately no client
-- insert/update policy: the registry is compiled through the SQL editor or a
-- service role by a human or agent, never by the app.
create policy "quest venues read verified"
  on public.quest_venues for select
  to authenticated
  using (active = true and verification_status = 'verified');

-- membership_chapter_placements intentionally has no client policies: it is
-- written through resolve_chapter_placement and read through the
-- my_current_items view, both SECURITY DEFINER and both scoping to
-- auth.uid() themselves. Same pattern as membership_item_sequence.

create policy "profiles read self"
  on public.profiles for select
  using (id = auth.uid());

-- Clients create/update their own profile row on sign-in (guest or email).
-- Everything else in this schema stays server-authoritative by design.
create policy "profiles insert self"
  on public.profiles for insert
  with check (id = auth.uid());

create policy "profiles update self"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "memberships read self"
  on public.hunt_memberships for select
  using (profile_id = auth.uid());

create policy "memberships read organization operators"
  on public.hunt_memberships for select
  using (
    exists (
      select 1
      from public.hunts h
      join public.organization_members om
        on om.organization_id = h.organization_id
      where h.id = hunt_memberships.hunt_id
        and om.profile_id = auth.uid()
    )
  );

create policy "help messages read thread participants"
  on public.help_messages for select
  using (
    exists (
      select 1
      from public.help_threads ht
      join public.hunt_memberships hm on hm.id = ht.membership_id
      where ht.id = help_messages.thread_id
        and (
          hm.profile_id = auth.uid()
          or exists (
            select 1
            from public.hunts h
            join public.organization_members om
              on om.organization_id = h.organization_id
            where h.id = hm.hunt_id
              and om.profile_id = auth.uid()
          )
        )
    )
  );

-- Do not add a broad client SELECT policy for location_pings. Serve the latest
-- authorized positions through a narrowly scoped server function that verifies
-- Hunt Master membership, hunt tier, active status, and the hunter's consent.

-- ---------------------------------------------------------------------------
-- Hunt joining and progress write path.
--
-- hunts, hunt_items, and item_completions intentionally have no direct client
-- policies above: order, QR validity, and completion are server-authoritative
-- (see PRODUCT_BLUEPRINT.md, business rules). The two functions below are the
-- only supported way a client mutates this data, and the view is the only
-- supported way a client reads upcoming clues. All three are SECURITY DEFINER
-- (owned by a role that bypasses RLS) so they can see across those tables
-- while still scoping every result to auth.uid() in their own logic. Do not
-- add "security_invoker = true" to the view below — that would make it
-- inherit the caller's RLS instead, and since hunt_items/item_completions
-- have no client SELECT policies, it would silently return nothing.
-- ---------------------------------------------------------------------------

-- Join a live hunt by its human-entered code. Re-joining is idempotent and
-- lets a hunter update their team name without creating a second membership.
create or replace function public.join_hunt(
  p_join_code text,
  p_team_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hunt public.hunts;
  v_membership public.hunt_memberships;
  v_total_published integer;
begin
  if auth.uid() is null then
    raise exception 'Sign in before joining a hunt';
  end if;

  select * into v_hunt
  from public.hunts
  where upper(join_code) = upper(trim(p_join_code))
    and status = 'live';

  if not found then
    raise exception 'That code did not match an active hunt';
  end if;

  insert into public.hunt_memberships (hunt_id, profile_id, team_name)
  values (v_hunt.id, auth.uid(), p_team_name)
  on conflict (hunt_id, profile_id) do update
    set team_name = coalesce(excluded.team_name, public.hunt_memberships.team_name)
  returning * into v_membership;

  -- Only generate once per membership: re-joining (e.g. reopening the app)
  -- must not reshuffle a hunter's remaining targets out from under them.
  -- pista/quest keep the shared authoring order (hunt_items.position);
  -- hare_hounds/ar/live each get their own random order, which is the whole
  -- point of those formats — see the hunt_format comment above.
  if not exists (
    select 1 from public.membership_item_sequence
    where membership_id = v_membership.id
  ) then
    if v_hunt.format in ('hare_hounds', 'ar', 'live') then
      insert into public.membership_item_sequence (membership_id, item_id, sequence_position)
      select v_membership.id, hi.id, row_number() over (order by random())
      from public.hunt_items hi
      where hi.hunt_id = v_hunt.id and hi.published = true;
    else
      insert into public.membership_item_sequence (membership_id, item_id, sequence_position)
      select v_membership.id, hi.id, hi.position
      from public.hunt_items hi
      where hi.hunt_id = v_hunt.id and hi.published = true;
    end if;
  end if;

  select count(*) into v_total_published
  from public.hunt_items
  where hunt_id = v_hunt.id and published = true;

  return jsonb_build_object(
    'membership_id', v_membership.id,
    'hunt_id', v_hunt.id,
    'hunt_name', v_hunt.name,
    'tier', v_hunt.tier,
    'format', v_hunt.format,
    'total_items', v_total_published,
    'completed_at', v_membership.completed_at
  );
end;
$$;

grant execute on function public.join_hunt(text, text) to authenticated;

-- The current clue plus every already-completed clue, for hunts the caller
-- has joined. Future clues stay invisible until their predecessor is
-- confirmed, so the app cannot be used to browse ahead. qr_token_hash is
-- deliberately not selected here.
--
-- "position" here is the hunter's own shuffled sequence_position (see
-- membership_item_sequence), not hunt_items.position — each hunter is
-- revealed targets in their own randomized order, not hunt_items' shared
-- authoring order, so hunters can't just follow each other to the next spot.
create view public.my_current_items as
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

-- ---------------------------------------------------------------------------
-- CLU/TRL Quest: venue lookup and placement persistence
-- ---------------------------------------------------------------------------

-- Great-circle distance in meters. Kept as a plain SQL function so the venue
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

-- Anchor a membership to a vetted venue. Idempotent and one-way: once a quest
-- has a venue it keeps it, so a player who walks out of range mid-quest is
-- not silently re-anchored somewhere else.
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

-- Verify a scanned QR against the hunter's current expected item, record an
-- idempotent completion, and issue the hunt's reward on the final item.
-- Raises a user-facing exception for every rejection path (wrong hunt,
-- wrong code, inactive hunt, exhausted reward inventory).
create or replace function public.submit_scan(
  p_membership_id uuid,
  p_raw_token text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_membership public.hunt_memberships;
  v_hunt public.hunts;
  v_next_position integer;
  v_item public.hunt_items;
  v_token_hash text;
  v_already_completed boolean := false;
  v_completed_count integer;
  v_total_published integer;
  v_hunt_complete boolean;
  v_reward record;
  v_redemption_raw text;
  v_redemption_hash text;
  v_result jsonb;
begin
  select * into v_membership
  from public.hunt_memberships
  where id = p_membership_id and profile_id = auth.uid();

  if not found then
    raise exception 'Membership not found for the current user';
  end if;

  select * into v_hunt from public.hunts where id = v_membership.hunt_id;

  if v_hunt.status <> 'live' then
    raise exception 'This hunt is not currently active';
  end if;
  if v_hunt.starts_at is not null and now() < v_hunt.starts_at then
    raise exception 'This hunt has not started yet';
  end if;
  if v_hunt.ends_at is not null and now() > v_hunt.ends_at then
    raise exception 'This hunt has ended';
  end if;

  select count(*) into v_completed_count
  from public.item_completions
  where membership_id = p_membership_id;

  v_next_position := v_completed_count + 1;

  select hi.* into v_item
  from public.membership_item_sequence mis
  join public.hunt_items hi
    on hi.id = mis.item_id and hi.published = true
  where mis.membership_id = p_membership_id
    and mis.sequence_position = v_next_position;

  if not found then
    raise exception 'This hunt has no further discoveries to confirm';
  end if;

  v_token_hash := encode(extensions.digest(p_raw_token, 'sha256'), 'hex');

  if v_token_hash <> v_item.qr_token_hash then
    raise exception 'That code does not match the next discovery';
  end if;

  insert into public.item_completions (membership_id, item_id, verification_method)
  values (p_membership_id, v_item.id, 'qr')
  on conflict (membership_id, item_id) do nothing;

  if not found then
    v_already_completed := true;
  end if;

  select count(*) into v_completed_count
  from public.item_completions
  where membership_id = p_membership_id;

  select count(*) into v_total_published
  from public.hunt_items
  where hunt_id = v_membership.hunt_id and published = true;

  v_hunt_complete := v_completed_count >= v_total_published;

  if v_hunt_complete and v_membership.completed_at is null then
    update public.hunt_memberships
    set completed_at = now()
    where id = p_membership_id;
  end if;

  v_result := jsonb_build_object(
    'newly_completed', not v_already_completed,
    'item_id', v_item.id,
    'position', v_next_position,
    'completed_count', v_completed_count,
    'total_items', v_total_published,
    'hunt_complete', v_hunt_complete
  );

  if v_hunt_complete then
    select r.* into v_reward
    from public.rewards r
    where r.hunt_id = v_membership.hunt_id
    order by r.created_at
    limit 1;

    if v_reward.id is not null then
      select redemption_token_hash into v_redemption_hash
      from public.reward_redemptions
      where reward_id = v_reward.id and membership_id = p_membership_id;

      if v_redemption_hash is null then
        if v_reward.inventory is not null then
          if (
            select count(*) from public.reward_redemptions
            where reward_id = v_reward.id
          ) >= v_reward.inventory then
            raise exception 'This reward is fully redeemed. Contact your Hunt Master.';
          end if;
        end if;

        v_redemption_raw := upper(encode(extensions.gen_random_bytes(6), 'hex'));
        v_redemption_hash := encode(extensions.digest(v_redemption_raw, 'sha256'), 'hex');

        insert into public.reward_redemptions (reward_id, membership_id, redemption_token_hash)
        values (v_reward.id, p_membership_id, v_redemption_hash);

        v_result := v_result || jsonb_build_object(
          'reward', jsonb_build_object(
            'title', v_reward.title,
            'terms', v_reward.terms,
            'redemption_code', v_redemption_raw,
            'already_issued', false
          )
        );
      else
        v_result := v_result || jsonb_build_object(
          'reward', jsonb_build_object(
            'title', v_reward.title,
            'terms', v_reward.terms,
            'redemption_code', null,
            'already_issued', true
          )
        );
      end if;
    end if;
  end if;

  return v_result;
end;
$$;

grant execute on function public.submit_scan(uuid, text) to authenticated;
