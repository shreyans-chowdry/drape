-- PL/pgSQL plans every branch of a CASE against NEW, so a single CASE that names
-- columns from several tables fails on all of them. Use one IF branch per table.
create or replace function public.check_parent_owner() returns trigger
language plpgsql security definer set search_path = public as $$
declare ok boolean := true;
begin
  if tg_table_name = 'clothing_images' then
    ok := exists (select 1 from public.clothing_items p where p.id = new.item_id and p.user_id = new.user_id);
  elsif tg_table_name = 'outfit_items' then
    ok := exists (select 1 from public.outfit_combinations p where p.id = new.outfit_id and p.user_id = new.user_id)
      and exists (select 1 from public.clothing_items p where p.id = new.item_id and p.user_id = new.user_id);
  elsif tg_table_name = 'trip_outfits' then
    ok := exists (select 1 from public.trip_plans p where p.id = new.trip_id and p.user_id = new.user_id)
      and exists (select 1 from public.outfit_combinations p where p.id = new.outfit_id and p.user_id = new.user_id);
  elsif tg_table_name = 'chat_messages' then
    ok := exists (select 1 from public.chat_conversations p where p.id = new.conversation_id and p.user_id = new.user_id);
  elsif tg_table_name = 'outfit_calendar' then
    ok := exists (select 1 from public.outfit_combinations p where p.id = new.outfit_id and p.user_id = new.user_id);
  elsif tg_table_name = 'clothing_locations' then
    ok := new.parent_id is null or exists (select 1 from public.clothing_locations p where p.id = new.parent_id and p.user_id = new.user_id);
  end if;
  if not ok then raise exception 'parent_not_owned' using errcode = '42501'; end if;
  return new;
end $$;
