-- Add certificate_type column to certificates table
alter table public.certificates
  add column certificate_type text not null default 'completion'
    check (certificate_type in ('completion', 'attendance', 'appreciation'));
