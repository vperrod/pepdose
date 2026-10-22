-- Server-side ceiling on updated_at. Sync orders rows by this stamp (LWW), and
-- it is client-supplied: a skewed or hostile client could send a future time
-- and win every merge. Clamp to the server clock on every write. Offline edits
-- keep their (past) edit time, so ordering semantics are unchanged.

create or replace function records_clamp_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := least(new.updated_at, now());
  return new;
end;
$$;

drop trigger if exists records_clamp_updated_at on records;
create trigger records_clamp_updated_at
  before insert or update on records
  for each row execute function records_clamp_updated_at();
