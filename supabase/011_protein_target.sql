-- Liahona — migration 011: editable daily protein target (grams).
-- Starts at the original 119–167 g; change it from the Protein page.
alter table user_settings
  add column if not exists protein_min int not null default 119,
  add column if not exists protein_max int not null default 167;
