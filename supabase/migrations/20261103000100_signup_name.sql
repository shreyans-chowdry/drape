-- Email sign-up sends the name as display_name; Google sends full_name / name.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare w uuid;
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, left(coalesce(nullif(trim(new.raw_user_meta_data->>'display_name'), ''), new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)), 60));
  insert into public.wardrobe_profiles (user_id, name, is_default) values (new.id, 'My wardrobe', true) returning id into w;
  update public.profiles set active_wardrobe_id = w where id = new.id;
  return new;
end $$;
