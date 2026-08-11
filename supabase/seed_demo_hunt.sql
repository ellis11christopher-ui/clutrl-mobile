-- CLUTRL demo hunt seed.
--
-- Creates one live, published, 10-item hunt ("Neon After Dark", join code
-- NIGHT-OWL) matching the local offline demo content, so join_hunt /
-- my_current_items / submit_scan can be exercised end to end against real
-- data instead of just reviewed.
--
-- Requires at least one row in public.profiles already (sign into the app
-- once, guest or email, before running this). Safe to re-run: every insert
-- is idempotent on a fixed id.
--
-- The QR tokens below (CLUTRL-NEON-01 .. 10) are deliberately short and
-- human-typeable for testing via the app's "Can't scan? Type the code"
-- fallback field. Production tokens should be long and random instead.

do $$
declare
  v_owner_id uuid;
  v_org_id uuid := '11111111-1111-1111-1111-111111111111';
  v_hunt_id uuid := '22222222-2222-2222-2222-222222222222';
begin
  select id into v_owner_id from public.profiles order by created_at limit 1;
  if v_owner_id is null then
    raise exception 'No profile exists yet. Sign into the app at least once (guest or email) before running this seed.';
  end if;

  insert into public.organizations (id, name, owner_id)
  values (v_org_id, 'CLUTRL Demo Events', v_owner_id)
  on conflict (id) do nothing;

  insert into public.organization_members (organization_id, profile_id, role)
  values (v_org_id, v_owner_id, 'owner')
  on conflict (organization_id, profile_id) do nothing;

  insert into public.hunts (
    id, organization_id, name, join_code, tier, status,
    reward_title, reward_copy, reward_terms
  )
  values (
    v_hunt_id, v_org_id, 'Neon After Dark', 'NIGHT-OWL', 'immersive', 'live',
    'You lit up the night.',
    'Show this screen at the finish tent for two VIP passes to tonight''s rooftop mixer.',
    'Valid tonight only. Single use.'
  )
  on conflict (id) do update set status = 'live';
end $$;

insert into public.hunt_items (
  hunt_id, position, title, clue_text, hint_text, kind,
  qr_token_hash, latitude, longitude, ar_asset_path, published
)
values
  ('22222222-2222-2222-2222-222222222222', 1, 'Start where the city glows',
   'Find the blue star that never sets. Look beneath the place where old neon gets a second life.',
   'It is close to the museum entrance.', 'text',
   encode(extensions.digest('CLUTRL-NEON-01', 'sha256'), 'hex'),
   36.1768, -115.1354, null, true),
  ('22222222-2222-2222-2222-222222222222', 2, 'A sign from another era',
   'Match the silhouette in this photo. The QR marker is mounted near its lowest red letter.',
   'Look for a restored motel sign.', 'photo',
   encode(extensions.digest('CLUTRL-NEON-02', 'sha256'), 'hex'),
   36.1759, -115.1362, null, true),
  ('22222222-2222-2222-2222-222222222222', 3, 'Listen to the wall',
   'Watch the twelve-second clip. Follow the mural''s painted gaze to the next target.',
   'Pause on the final frame.', 'video',
   encode(extensions.digest('CLUTRL-NEON-03', 'sha256'), 'hex'),
   36.1749, -115.1371, null, true),
  ('22222222-2222-2222-2222-222222222222', 4, 'Four corners, one answer',
   'I hold stories but have no pages. Find the box painted with four local legends.',
   'Street art can turn utility into a canvas.', 'text',
   encode(extensions.digest('CLUTRL-NEON-04', 'sha256'), 'hex'),
   36.1737, -115.1377, null, true),
  ('22222222-2222-2222-2222-222222222222', 5, 'Meet the desert fox',
   'Enter AR mode at the marked corner. Find the floating desert fox and frame it above the skyline.',
   'Slowly turn toward the west.', 'ar',
   encode(extensions.digest('CLUTRL-NEON-05', 'sha256'), 'hex'),
   36.1728, -115.1382, 'ar-assets/demo/desert-fox.usdz', true),
  ('22222222-2222-2222-2222-222222222222', 6, 'The quiet pour',
   'Find this tiled pattern outside the coffee bar. Your marker is beneath the copper counter.',
   'The pattern repeats in sets of six.', 'photo',
   encode(extensions.digest('CLUTRL-NEON-06', 'sha256'), 'hex'),
   36.1719, -115.1391, null, true),
  ('22222222-2222-2222-2222-222222222222', 7, 'A little bird told us',
   'Watch for the yellow door in the clip, then find the metal bird perched nearby.',
   'Look above eye level.', 'video',
   encode(extensions.digest('CLUTRL-NEON-07', 'sha256'), 'hex'),
   36.1708, -115.1398, null, true),
  ('22222222-2222-2222-2222-222222222222', 8, 'Count the lucky sevens',
   'Three sevens hide in plain sight. The middle one points to your next QR marker.',
   'A vintage storefront keeps score.', 'text',
   encode(extensions.digest('CLUTRL-NEON-08', 'sha256'), 'hex'),
   36.1698, -115.1401, null, true),
  ('22222222-2222-2222-2222-222222222222', 9, 'Frame the impossible bloom',
   'At the geo marker, reveal the neon desert bloom and capture it with your team in the frame.',
   'Stand within 15 meters of the target.', 'ar',
   encode(extensions.digest('CLUTRL-NEON-09', 'sha256'), 'hex'),
   36.1688, -115.1406, 'ar-assets/demo/desert-bloom.usdz', true),
  ('22222222-2222-2222-2222-222222222222', 10, 'The last light',
   'Return to where every color meets. Find the rainbow arch and scan the marker at its base.',
   'Your finish line is also a photo spot.', 'text',
   encode(extensions.digest('CLUTRL-NEON-10', 'sha256'), 'hex'),
   36.1677, -115.1412, null, true)
on conflict (hunt_id, position) do update set
  qr_token_hash = excluded.qr_token_hash,
  title = excluded.title,
  clue_text = excluded.clue_text,
  hint_text = excluded.hint_text,
  published = true;

insert into public.rewards (hunt_id, title, terms)
select
  '22222222-2222-2222-2222-222222222222',
  'You lit up the night.',
  'Show this screen at the finish tent for two VIP passes to tonight''s rooftop mixer. Valid tonight only, single use.'
where not exists (
  select 1 from public.rewards where hunt_id = '22222222-2222-2222-2222-222222222222'
);

-- Sanity check: raises if fewer than 10 published items exist.
select public.assert_hunt_publishable('22222222-2222-2222-2222-222222222222');
