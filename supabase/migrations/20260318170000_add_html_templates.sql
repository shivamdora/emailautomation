alter table public.templates
  add column if not exists body_html_template text;

notify pgrst, 'reload schema';
