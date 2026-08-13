-- CLU/TRL Quest: return the anchored venue from join_hunt.
--
-- Patch migration — run once in the Supabase SQL Editor, after
-- migrate_sunset_cutoff.sql. Functions only, no RLS advisor prompt.
--
-- WHY
-- ---------------------------------------------------------------------------
-- A Quest is 22 chapters played across many sessions, and the venue it is
-- anchored to lives server-side. Without returning it at join time, reopening
-- the app mid-quest leaves the client with no idea where the player is
-- playing, so it would show the venue picker again — for a quest that is
-- already anchored and cannot move. anchor_quest_venue would quietly return
-- the original venue no matter what was tapped, which is safe but reads as a
-- bug to the player.
--
-- So join_hunt now hands back the anchored venue when there is one. The
-- client can then resume straight into the current chapter.

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
  v_venue public.quest_venues;
  v_venue_json jsonb := null;
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

  -- Resume information for an already-anchored Quest. Deliberately not
  -- re-checked against the venue's playable window here: a quest in progress
  -- keeps its venue, and whether play should continue right now is decided by
  -- find_quest_venues_near when a venue is first chosen.
  if v_membership.quest_venue_id is not null then
    select * into v_venue
    from public.quest_venues
    where id = v_membership.quest_venue_id;

    if found then
      v_venue_json := jsonb_build_object(
        'venue_id', v_venue.id,
        'name', v_venue.name,
        'latitude', v_venue.latitude,
        'longitude', v_venue.longitude,
        'play_radius_meters', v_venue.play_radius_meters,
        'newly_anchored', false
      );
    end if;
  end if;

  return jsonb_build_object(
    'membership_id', v_membership.id,
    'hunt_id', v_hunt.id,
    'hunt_name', v_hunt.name,
    'tier', v_hunt.tier,
    'format', v_hunt.format,
    'total_items', v_total_published,
    'completed_at', v_membership.completed_at,
    'quest_venue', v_venue_json
  );
end;
$$;

grant execute on function public.join_hunt(text, text) to authenticated;
