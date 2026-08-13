-- CLU/TRL Quest: reservation-gated lighting and evening cutoffs.
--
-- Patch migration — migrate_quest_venues.sql has already been applied to this
-- project, so this adds to it rather than replacing it. Run once in the
-- Supabase SQL Editor. No new tables, so the RLS advisor should not prompt.
--
-- THE PROBLEM THIS FIXES
-- ---------------------------------------------------------------------------
-- "Has lights" and "will be lit" are not the same claim. Many municipal
-- fields only energize their lights when someone has reserved and paid for
-- them — Phoenix, for example, charges a $5/hour light fee for evening use.
-- A player who shows up at 8 p.m. on a night nobody booked finds an
-- unlit field, which is exactly the hazard the venue policy exists to
-- prevent.
--
-- So reservation-gated lighting is now tracked separately from whether
-- lighting exists at all, and any venue whose lights depend on a booking —
-- or that has no lights at all — must carry an evening cutoff after which
-- the app will not serve it. The cutoff is enforced in
-- find_quest_venues_near, evaluated against the venue's own local clock.

-- ---------------------------------------------------------------------------
-- New columns
-- ---------------------------------------------------------------------------

alter table public.quest_venues
  -- True when lights exist but only come on for a paid/booked reservation,
  -- i.e. the venue cannot be relied on to be lit for a walk-up player.
  add column lighting_requires_reservation boolean not null default false,

  -- Playable window in the venue's own local time. Either bound may be null
  -- for a venue that is genuinely fine around the clock, but the constraint
  -- below forces an upper bound wherever darkness is a real possibility.
  add column playable_from_local time,
  add column playable_until_local time;

-- IANA zone name, used to evaluate the cutoff against local wall-clock time.
-- Added with a default so the statement succeeds, then the default is dropped
-- so every future insert has to state its own zone — a venue silently
-- inheriting the wrong timezone would compute its cutoff hours off.
alter table public.quest_venues
  add column time_zone text not null default 'America/Phoenix';

alter table public.quest_venues
  alter column time_zone drop default;

-- A venue that cannot be counted on to be lit must say when it stops being
-- playable. This covers both reservation-gated lighting and venues with no
-- lighting at all; a venue with dusk-to-close municipal lighting can leave
-- the cutoff null.
alter table public.quest_venues
  add constraint quest_venues_dark_venues_require_cutoff check (
    (lighting_requires_reservation = false and lighting <> 'unlit')
    or playable_until_local is not null
  );

-- ---------------------------------------------------------------------------
-- Venue lookup, now time-aware
-- ---------------------------------------------------------------------------

-- Dropped rather than replaced because the return type gains columns, which
-- CREATE OR REPLACE cannot do for a set-returning function.
drop function if exists public.find_quest_venues_near(
  double precision, double precision, integer, integer
);

create function public.find_quest_venues_near(
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
  lighting_requires_reservation boolean,
  playable_until_local time,
  time_zone text,
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
    v.lighting_requires_reservation,
    v.playable_until_local,
    v.time_zone,
    v.verifying_authority,
    public.haversine_meters(p_latitude, p_longitude, v.latitude, v.longitude)
  from public.quest_venues v
  where v.active = true
    and v.verification_status = 'verified'
    -- Outside its playable window, a venue is simply not offered. Evaluated
    -- in the venue's own timezone, not the server's or the player's.
    and (
      v.playable_from_local is null
      or (now() at time zone v.time_zone)::time >= v.playable_from_local
    )
    and (
      v.playable_until_local is null
      or (now() at time zone v.time_zone)::time < v.playable_until_local
    )
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
