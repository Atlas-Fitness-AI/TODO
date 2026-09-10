-- Presence heartbeat: stamped by `todo sync` (every skill command) and by the
-- dashboard while it is open. Lets the crew roster tell "working" from
-- "away" instead of relying on task state alone.
alter table public.profiles
  add column last_seen timestamptz;
