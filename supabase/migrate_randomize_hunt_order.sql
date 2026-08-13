-- Incremental migration for the ALREADY-DEPLOYED database: gives every
-- hunter their own randomized visiting order over a hunt's targets, instead
-- of everyone getting the same fixed hunt_items.position order. That fixed
-- order was letting hunters just follow whoever found the last target,
-- since everyone's "next clue" was always the same physical spot at the
-- same time.
--
-- Safe to run against the live project as-is (schema.sql has already been
-- applied there) — this only adds a new table and replaces the view/function
-- bodies that schema.sql now also reflects for fresh installs. Run this once
-- in the Supabase SQL Editor.
--
-- IMPORTANT: any hunt with hunters already mid-hunt should be reset after
-- this runs (see reset_demo_hunt.sql) — their existing item_completions were
-- recorded against the old shared order and won't line up with a freshly
-- generated random order. New joins after this migration are unaffected.

create table if not exists public.membership_item_sequence (
  membership_id uuid not null references public.hunt_memberships(id) on delete cascade,
  item_id uuid not null references public.hunt_items(id) on delete cascade,
  sequence_position integer not null check (sequence_position > 0),
  primary key (membership_id, item_id),
  unique (membership_id, sequence_position)
);

alter table public.membership_item_sequence enable row level security;

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

  if not exists (
    select 1 from public.membership_item_sequence
    where membership_id = v_membership.id
  ) then
    insert into public.membership_item_sequence (membership_id, item_id, sequence_position)
    select v_membership.id, hi.id, row_number() over (order by random())
    from public.hunt_items hi
    where hi.hunt_id = v_hunt.id and hi.published = true;
  end if;

  select count(*) into v_total_published
  from public.hunt_items
  where hunt_id = v_hunt.id and published = true;

  return jsonb_build_object(
    'membership_id', v_membership.id,
    'hunt_id', v_hunt.id,
    'hunt_name', v_hunt.name,
    'tier', v_hunt.tier,
    'total_items', v_total_published,
    'completed_at', v_membership.completed_at
  );
end;
$$;

grant execute on function public.join_hunt(text, text) to authenticated;

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
  ic.completed_at
from public.hunt_memberships hm
join public.membership_item_sequence mis
  on mis.membership_id = hm.id
join public.hunt_items hi
  on hi.id = mis.item_id and hi.published = true
left join public.item_completions ic
  on ic.membership_id = hm.id and ic.item_id = hi.id
where hm.profile_id = auth.uid()
  and mis.sequence_position <= (
    select count(*) + 1
    from public.item_completions ic2
    where ic2.membership_id = hm.id
  );

grant select on public.my_current_items to authenticated;

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
