-- How long or since when the animal is in the shelter, as the shelter writes it
-- ("nuo 2026 m. birželio mėn.", "1mėn. 7d."). Unknown stays null.
alter table public.snapshot_animals add column in_shelter text;

-- s.* is expanded at creation, so the view must be recreated to include the new column.
drop view public.published_animals;
create view public.published_animals
with (security_invoker = true)
as
select s.*, r.source, r.published_at, a.source_url
from public.snapshot_animals s
join public.source_runs r on r.id = s.run_id
join public.animals a on a.id = s.animal_id
where r.id in (
  select distinct on (source) id from public.source_runs
  where published
  order by source, published_at desc, id desc
);

grant select on public.published_animals to anon, authenticated;
