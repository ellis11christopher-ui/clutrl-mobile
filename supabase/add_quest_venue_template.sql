-- Template for adding a CLU/TRL Quest venue to the registry.
--
-- Copy this block, fill in the << >> placeholders, and run it in the SQL
-- Editor. Every venue lands as 'pending' and is invisible to the app until
-- it is separately promoted to 'verified' with real provenance (second block
-- below).
--
-- WHY TWO STEPS: a venue is a place the app will send a player, possibly a
-- child, possibly after dark. Marking one 'verified' is an assertion that a
-- named authority publishes that the site is public, maintained, and lit.
-- The schema enforces that assertion structurally — the promote step below
-- fails outright if the authority, source URL, date, or lighting status is
-- missing — but the schema cannot tell whether the citation is real. Only
-- paste a source URL you have actually opened and read.
--
-- Eligible venue_type values (nothing else qualifies for Quest play):
--   'public_park'           public park
--   'municipal_trail'       municipality-maintained trail
--   'city_soccer_field'     city-run soccer field
--   'public_outdoor_arena'  public outdoor arena
--
-- lighting values: 'lit' | 'partially_lit' | 'unlit' | 'unknown'
--   Only 'lit' and 'partially_lit' should ever be promoted to verified, and
--   'partially_lit' venues should carry a verification_note describing which
--   part of the site is lit.
--
-- RESERVATION-GATED LIGHTING
--   Set lighting_requires_reservation = true wherever the lights only come
--   on for a paid or booked reservation. "Has lights" is not "will be lit":
--   a walk-up player at 8 p.m. on an unbooked night finds a dark field. Any
--   such venue — and any venue with lighting = 'unlit' — must also carry a
--   playable_until_local cutoff, and the schema will reject it otherwise.
--   find_quest_venues_near stops offering the venue past that local time.
--
-- time_zone
--   IANA name (e.g. 'America/Phoenix', 'America/New_York'). Required, with
--   no default on purpose: the cutoff is evaluated in this zone, so an
--   inherited wrong value would be hours off.

-- ---------------------------------------------------------------------------
-- STEP 1 — add the candidate (safe: lands as 'pending', app cannot see it)
-- ---------------------------------------------------------------------------

insert into public.quest_venues (
  name,
  venue_type,
  locality,
  region,
  country_code,
  latitude,
  longitude,
  play_radius_meters,
  lighting_requires_reservation,
  playable_until_local,
  time_zone,
  submitted_by
)
values (
  '<<VENUE NAME>>',
  '<<public_park | municipal_trail | city_soccer_field | public_outdoor_arena>>',
  '<<CITY OR TOWN>>',
  '<<STATE / PARISH / BOROUGH / COUNTY, or NULL>>',
  'US',
  <<LATITUDE>>,
  <<LONGITUDE>>,
  150,          -- playable radius in meters; keep inside the actual grounds
  <<true if lights need a booking, else false>>,
  '<<HH:MM evening cutoff, or NULL only if lights are always on>>',
  '<<IANA zone, e.g. America/Phoenix>>',
  '<<agent | human>>'
);

-- ---------------------------------------------------------------------------
-- STEP 2 — promote to verified (only with a source you have actually read)
-- ---------------------------------------------------------------------------
--
-- This will FAIL if verifying_authority, verification_source_url,
-- verified_at, or a real lighting status is missing. That failure is the
-- safety net working, not a bug — do not work around it by relaxing the
-- constraint.

update public.quest_venues
set
  lighting = '<<lit | partially_lit>>',
  verifying_authority = '<<e.g. City of Henderson Parks & Recreation>>',
  verification_source_url = '<<URL of the authority page stating hours/lighting>>',
  verification_note = '<<e.g. Lit walking loop and field; wooded east end unlit.>>',
  verified_at = now(),
  verification_status = 'verified',
  updated_at = now()
where name = '<<VENUE NAME>>'
  and locality = '<<CITY OR TOWN>>';

-- ---------------------------------------------------------------------------
-- Useful review queries
-- ---------------------------------------------------------------------------

-- Candidates still awaiting verification:
-- select name, locality, region, venue_type, submitted_by, created_at
-- from public.quest_venues
-- where verification_status = 'pending'
-- order by created_at desc;

-- Everything currently live for players:
-- select name, locality, venue_type, lighting, verifying_authority, verified_at
-- from public.quest_venues
-- where verification_status = 'verified' and active = true
-- order by locality, name;

-- Retire a venue without deleting its verification history:
-- update public.quest_venues
-- set active = false, updated_at = now()
-- where name = '<<VENUE NAME>>' and locality = '<<CITY OR TOWN>>';
