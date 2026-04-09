-- Ensure character identity template snapshots are nullable for custom-first flow.
-- Some environments may still have NOT NULL/default '{}' from the original content foundation migration.

alter table if exists public.characters
  alter column class_template_snapshot drop not null,
  alter column race_template_snapshot drop not null,
  alter column background_template_snapshot drop not null,
  alter column class_template_snapshot drop default,
  alter column race_template_snapshot drop default,
  alter column background_template_snapshot drop default;
