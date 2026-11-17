-- An unpublished run must not expose an animal's stable ID, source URL, or
-- manual status entries through direct reads of the base tables.
-- snapshot_animals' SELECT policy already restricts the subquery to published
-- runs. The existing animal_id index supports both checks.
alter policy "public read animals" on public.animals
  using (exists (
    select 1 from public.snapshot_animals s where s.animal_id = animals.id
  ));

alter policy "public read status history" on public.animal_status_history
  using (
    exists (
      select 1 from public.snapshot_animals s
      where s.animal_id = animal_status_history.animal_id
    )
    and (
      source_run_id is null
      or exists (
        select 1 from public.source_runs r
        where r.id = animal_status_history.source_run_id and r.published
      )
    )
  );
