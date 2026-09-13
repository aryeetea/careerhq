-- Make Retro Arcade the persisted default, not only the browser fallback.
-- The original constraint predates the newer theme choices, so without this
-- migration saving Arcade from the picker can fail at the database layer.
alter table public.settings
  drop constraint if exists settings_theme_check;

alter table public.settings
  alter column theme set default 'arcade',
  add constraint settings_theme_check
    check (theme in ('floral', 'neutral', 'sunrise', 'meadow', 'dark', 'midnight', 'comic-pop', 'arcade', 'candy'));

-- Values from the pre-refresh palette were only defaults/legacy selections.
-- Move them once at the source so account sync cannot restore the old look.
update public.settings
set theme = 'arcade'
where theme in ('floral', 'neutral', 'sunrise', 'meadow', 'dark', 'midnight');
