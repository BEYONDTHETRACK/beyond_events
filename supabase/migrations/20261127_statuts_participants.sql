-- Statuts des participants : inscrit, validé, DNS (non-partant), DNF (abandon), finisher.
-- « en course » reste accepté pour les données existantes mais n'est plus proposé.
alter table public.participants drop constraint if exists participants_status_check;
alter table public.participants add constraint participants_status_check
  check (status = any (array['inscrit', 'valide', 'dns', 'en course', 'abandon', 'finisher']));
