create table if not exists repo_index (
  id bigserial primary key,
  path text,
  sha text,
  data jsonb,
  updated_at timestamp
);
