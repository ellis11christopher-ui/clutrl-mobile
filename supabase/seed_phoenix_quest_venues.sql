-- CLU/TRL Quest venue candidates — Phoenix, AZ (research pass 1)
--
-- EVERY ROW HERE IS 'pending'. Nothing in this file is cleared for play, and
-- the app cannot see any of it until it is promoted (see
-- add_quest_venue_template.sql, STEP 2).
--
-- WHY NOTHING IS VERIFIED YET
-- ---------------------------------------------------------------------------
-- The names, addresses, and amenity lists below come from the City of Phoenix
-- Parks and Recreation "Reserve an Athletic Field" page, which is an
-- authoritative municipal source. That page establishes that Phoenix operates
-- lighted athletic fields and that lighting is bookable into the evening:
--
--   "Most lighted athletic fields are available to book from 4 p.m. to 10
--    p.m. Monday thru Friday and on weekends from 8 a.m. to 10 p.m. Athletic
--    fields without lights are available from 4 p.m. to 6 p.m. only."
--
--   "A $5 hourly fee for lights will be charged for night time activities
--    (6 p.m. to 10 p.m.)"
--
-- What that page does NOT do is say WHICH complexes have lights. The
-- per-complex amenity lists (Ball Field, Soccer Field, Restrooms, and so on)
-- carry no lighting flag at all, and the individual facility pages state
-- hours only as "Please contact facility directly."
--
-- So a per-venue lighting attestation does not exist in Phoenix's published
-- park data. Marking any of these 'lit' right now would be inventing the one
-- fact the whole safety policy rests on, and the schema constraint would
-- reject it anyway for lacking a real source. Confirm lighting per venue
-- through the reservation system (lights appear as a per-field paid add-on
-- when booking) or directly with Parks and Recreation, then promote.
--
-- PHOENIX LIGHTING IS RESERVATION-GATED
-- ---------------------------------------------------------------------------
-- The $5/hour light fee is itself the finding that matters: where Phoenix
-- fields have lights, those lights are energized for a paid booking, not
-- left on for whoever shows up. Under the venue policy that makes every one
-- of these reservation-gated, so each row sets
-- lighting_requires_reservation = true and carries an evening cutoff.
--
-- The 17:00 cutoff below is a deliberately conservative placeholder, chosen
-- because Phoenix's earliest sunset is roughly 5:20 p.m. in December, so
-- 5 p.m. is the only fixed local time that is safe year-round. In June that
-- is over two hours before dark and needlessly strict. A sunset-relative
-- rule (playable until, say, 30 minutes before local sunset) would be the
-- better long-term design and is not built yet — treat this number as a
-- product decision still open, not a researched value.
--
-- COORDINATES ARE APPROXIMATE — CONFIRM BEFORE PROMOTING
-- ---------------------------------------------------------------------------
-- Latitude/longitude below are derived from each street address against the
-- Phoenix street grid, NOT from an authoritative geocode. They are good to
-- roughly a few hundred meters, which is larger than the default 150 m play
-- radius. Drop each pin on a map and correct it before promoting the venue,
-- or the play area will not line up with the actual grounds.
--
-- EXCLUDED ON PURPOSE
-- ---------------------------------------------------------------------------
-- Papago Baseball / Softball Complex (1802 N 64th St) is a city sports
-- complex but is baseball/softball only. It does not map to any of the four
-- eligible Quest venue types (public park, municipal trail, city soccer
-- field, public outdoor arena), so it is left out rather than forced into a
-- category it does not fit. Add it later if the eligible-type list widens.
--
-- Source (all rows): City of Phoenix Parks and Recreation, "Reserve an
-- Athletic Field", https://www.phoenix.gov/administration/departments/parks/rentals-permits/reserve-an-athletic-field.html
-- Retrieved 2026-08-13.

insert into public.quest_venues (
  name,
  venue_type,
  locality,
  region,
  country_code,
  latitude,
  longitude,
  play_radius_meters,
  lighting,
  lighting_requires_reservation,
  playable_until_local,
  time_zone,
  verification_status,
  verification_note,
  submitted_by
)
values
  (
    'Desert West Sports Complex',
    'city_soccer_field',
    'Phoenix',
    'Arizona',
    'US',
    33.4752,
    -112.2170,
    150,
    'unknown',
    true,
    '17:00',
    'America/Phoenix',
    'pending',
    '6602 W Encanto Blvd. City-listed amenities include Soccer Field, Ball Field, Basketball Court, Playground, Restrooms, Urban Fishing. LIGHTING NOT STATED per-venue by the city; confirm via reservation system or Parks and Rec before promoting. COORDINATES APPROXIMATE (grid-derived from address) — confirm on a map.',
    'agent'
  ),
  (
    'Encanto Sports Complex',
    'city_soccer_field',
    'Phoenix',
    'Arizona',
    'US',
    33.4864,
    -112.1065,
    150,
    'unknown',
    true,
    '17:00',
    'America/Phoenix',
    'pending',
    '2121 N 15th Ave. City-listed amenities include Soccer Field, Ball Field, Basketball Court, Playground, Restrooms, ADA Accessible, Urban Fishing. LIGHTING NOT STATED per-venue by the city; confirm before promoting. COORDINATES APPROXIMATE (grid-derived from address) — confirm on a map.',
    'agent'
  ),
  (
    'Reach 11 Sports Complex',
    'city_soccer_field',
    'Phoenix',
    'Arizona',
    'US',
    33.8030,
    -112.0215,
    150,
    'unknown',
    true,
    '17:00',
    'America/Phoenix',
    'pending',
    '2425 E Deer Valley Rd. City-listed amenities include Soccer Field, Ball Field, Playground, Restrooms, Shade Structures. LIGHTING NOT STATED per-venue by the city; confirm before promoting. COORDINATES APPROXIMATE (grid-derived from address) — confirm on a map.',
    'agent'
  ),
  (
    'Rose Mofford Sports Complex',
    'city_soccer_field',
    'Phoenix',
    'Arizona',
    'US',
    33.6261,
    -112.1282,
    150,
    'unknown',
    true,
    '17:00',
    'America/Phoenix',
    'pending',
    '9833 N 25th Ave. City-listed amenities include Soccer Field, Ball Field, Basketball Court, Pickleball, Tennis, Playground, Restrooms. Facility page lists hours only as "Please contact facility directly" (602-261-8011). LIGHTING NOT STATED per-venue by the city; confirm before promoting. COORDINATES APPROXIMATE (grid-derived from address) — confirm on a map.',
    'agent'
  );

-- Review what landed:
-- select name, locality, venue_type, lighting, verification_status
-- from public.quest_venues
-- where locality = 'Phoenix'
-- order by name;
