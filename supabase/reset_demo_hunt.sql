-- Resets the seeded "Neon After Dark" hunt (join code NIGHT-OWL) so it can
-- be played through again from Discovery 1.
--
-- Safe to run any time you want a clean run: makes sure the hunt itself is
-- live with no start/end window, then deletes every membership tied to it.
-- item_completions and reward_redemptions cascade-delete automatically via
-- their foreign keys, so this clears all prior progress and issued reward
-- codes for this hunt too. The hunt_items (the 10 clues/QR tokens) and the
-- reward definition are untouched — only per-player progress resets.

update public.hunts
set status = 'live', starts_at = null, ends_at = null
where id = '22222222-2222-2222-2222-222222222222';

delete from public.hunt_memberships
where hunt_id = '22222222-2222-2222-2222-222222222222';
