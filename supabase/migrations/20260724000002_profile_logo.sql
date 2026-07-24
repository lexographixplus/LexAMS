-- Add logo_url to profiles
alter table public.profiles
  add column logo_url text;

-- Create a logos storage bucket (public so certificates can display it)
insert into storage.buckets (id, name, public)
values ('logos', 'logos', true)
on conflict (id) do nothing;

create policy "Authenticated users can upload logos"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'logos');

create policy "Authenticated users can update logos"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'logos');

create policy "Anyone can view logos"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'logos');
