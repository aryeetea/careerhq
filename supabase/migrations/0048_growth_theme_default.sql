-- Growth replaces Retro Arcade as the default visual direction.
alter table public.settings
  drop constraint if exists settings_theme_check;

alter table public.settings
  alter column theme set default 'growth',
  add constraint settings_theme_check
    check (theme in ('floral', 'neutral', 'sunrise', 'meadow', 'dark', 'midnight', 'comic-pop', 'arcade', 'candy', 'growth'));

update public.settings
set theme = 'growth'
where theme = 'arcade';
