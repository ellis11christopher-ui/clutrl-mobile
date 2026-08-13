-- CLU/TRL Quest: sunset-relative evening cutoffs.
--
-- Patch migration — run once in the Supabase SQL Editor, after
-- migrate_venue_evening_cutoff.sql. No new tables, so the RLS advisor should
-- not prompt.
--
-- WHY THIS REPLACES THE FIXED CUTOFF
-- ---------------------------------------------------------------------------
-- A fixed local cutoff has to be set for the darkest night of the year or it
-- is unsafe. In Phoenix that means 17:00, because the earliest sunset is
-- about 5:20 p.m. in December — which then closes every venue two and a half
-- hours before dark in June. Every city has this problem, and it gets worse
-- with latitude.
--
-- So the cutoff becomes relative to actual local sunset for the venue's own
-- coordinates and today's date, with a per-venue safety buffer. A venue whose
-- lights depend on a booking stops being offered N minutes before the sun
-- goes down, wherever and whenever that happens to be.
--
-- Fixed playable_until_local is kept and still honored — it is the right tool
-- for a hard constraint like a posted park closing time. Where both are set,
-- both apply and the earlier one wins.

-- ---------------------------------------------------------------------------
-- Solar math (pure SQL, no PostGIS)
-- ---------------------------------------------------------------------------

create or replace function public.mod_360(x double precision)
returns double precision
language sql
immutable
parallel safe
set search_path = ''
as $$
  select x - 360.0 * floor(x / 360.0);
$$;

-- Sunset in UTC for a coordinate on a given date, via the standard NOAA
-- sunrise/sunset approximation. Accurate to well under a minute, which is far
-- finer than the safety buffer this feeds.
--
-- Returns NULL where the sun does not set that day (polar summer) or does not
-- rise (polar winter). Callers must treat NULL as "not playable" — see the
-- filter in find_quest_venues_near, where a NULL comparison drops the row.
create or replace function public.solar_sunset_utc(
  p_latitude double precision,
  p_longitude double precision,
  p_on_date date
)
returns timestamptz
language plpgsql
immutable
parallel safe
set search_path = ''
as $$
declare
  n double precision;
  j_star double precision;
  m double precision;
  c double precision;
  lambda double precision;
  j_transit double precision;
  sin_declination double precision;
  cos_hour_angle double precision;
  hour_angle double precision;
  j_set double precision;
begin
  -- Days since the J2000 epoch, plus the algorithm's leap-second fudge.
  n := (p_on_date - date '2000-01-01') + 0.0008;

  -- Mean solar noon at this longitude.
  j_star := n - p_longitude / 360.0;

  -- Solar mean anomaly.
  m := public.mod_360(357.5291 + 0.98560028 * j_star);

  -- Equation of the center.
  c := 1.9148 * sin(radians(m))
     + 0.0200 * sin(radians(2 * m))
     + 0.0003 * sin(radians(3 * m));

  -- Ecliptic longitude (102.9372 is the argument of perihelion).
  lambda := public.mod_360(m + c + 180 + 102.9372);

  -- Solar transit (local solar noon) as a Julian date.
  j_transit := 2451545.0 + j_star
             + 0.0053 * sin(radians(m))
             - 0.0069 * sin(radians(2 * lambda));

  -- Declination of the sun (23.44 deg axial tilt).
  sin_declination := sin(radians(lambda)) * sin(radians(23.44));

  -- Hour angle at sunset. -0.833 deg accounts for atmospheric refraction and
  -- the solar disc's radius, i.e. the moment the upper limb touches the
  -- horizon rather than the geometric center.
  cos_hour_angle := (sin(radians(-0.833)) - sin(radians(p_latitude)) * sin_declination)
                  / (cos(radians(p_latitude)) * cos(asin(sin_declination)));

  -- Out of domain means the sun never reaches the horizon that day.
  if cos_hour_angle > 1.0 or cos_hour_angle < -1.0 then
    return null;
  end if;

  hour_angle := degrees(acos(cos_hour_angle));
  j_set := j_transit + hour_angle / 360.0;

  -- Julian date to epoch seconds.
  return to_timestamp((j_set - 2440587.5) * 86400.0);
end;
$$;

-- ---------------------------------------------------------------------------
-- Venue column
-- ---------------------------------------------------------------------------

alter table public.quest_venues
  add column sunset_buffer_minutes integer
    check (sunset_buffer_minutes is null or sunset_buffer_minutes between 0 and 240);

comment on column public.quest_venues.sunset_buffer_minutes is
  'Stop offering this venue this many minutes before local sunset. NULL means no sunset rule, which is only appropriate for reliably lit venues.';

-- A venue that cannot be counted on to be lit now satisfies the requirement
-- with either bound: a sunset-relative buffer (preferred) or a fixed local
-- cutoff. It still cannot have neither.
alter table public.quest_venues
  drop constraint if exists quest_venues_dark_venues_require_cutoff;

alter table public.quest_venues
  add constraint quest_venues_dark_venues_require_cutoff check (
    (lighting_requires_reservation = false and lighting <> 'unlit')
    or playable_until_local is not null
    or sunset_buffer_minutes is not null
  );

-- ---------------------------------------------------------------------------
-- Venue lookup, now sunset-aware
-- ---------------------------------------------------------------------------

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
  sunset_buffer_minutes integer,
  closes_at timestamptz,
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
    v.sunset_buffer_minutes,
    -- Surfaced so the app can say "closes at 7:42 PM" instead of just
    -- making the venue vanish from the list without explanation.
    case
      when v.sunset_buffer_minutes is null then null
      else public.solar_sunset_utc(
             v.latitude, v.longitude, (now() at time zone v.time_zone)::date
           ) - make_interval(mins => v.sunset_buffer_minutes)
    end,
    v.time_zone,
    v.verifying_authority,
    public.haversine_meters(p_latitude, p_longitude, v.latitude, v.longitude)
  from public.quest_venues v
  where v.active = true
    and v.verification_status = 'verified'
    -- Fixed local window, e.g. a posted park closing time.
    and (
      v.playable_from_local is null
      or (now() at time zone v.time_zone)::time >= v.playable_from_local
    )
    and (
      v.playable_until_local is null
      or (now() at time zone v.time_zone)::time < v.playable_until_local
    )
    -- Sunset-relative window. Note this fails closed: if solar_sunset_utc
    -- returns NULL (polar day/night) the comparison is NULL and the venue is
    -- dropped, which is the safe direction to be wrong in.
    and (
      v.sunset_buffer_minutes is null
      or now() < public.solar_sunset_utc(
                   v.latitude, v.longitude, (now() at time zone v.time_zone)::date
                 ) - make_interval(mins => v.sunset_buffer_minutes)
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

-- ---------------------------------------------------------------------------
-- Move the Phoenix candidates off their fixed-time placeholder
-- ---------------------------------------------------------------------------
-- Only affects rows if seed_phoenix_quest_venues.sql was already run. They
-- stay 'pending' either way; this just swaps the conservative 17:00 stand-in
-- for the sunset rule it was standing in for.

update public.quest_venues
set sunset_buffer_minutes = 30,
    playable_until_local = null,
    updated_at = now()
where locality = 'Phoenix'
  and lighting_requires_reservation = true;

-- Sanity check the solar math against a known reference. Phoenix on the 2026
-- summer solstice sets at roughly 19:42 local (MST, no DST), and on the
-- winter solstice at roughly 17:22 local.
-- select
--   public.solar_sunset_utc(33.4484, -112.0740, date '2026-06-21')
--     at time zone 'America/Phoenix' as summer_solstice_sunset,
--   public.solar_sunset_utc(33.4484, -112.0740, date '2026-12-21')
--     at time zone 'America/Phoenix' as winter_solstice_sunset;
