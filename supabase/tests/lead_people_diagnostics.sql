-- ---------------------------------------------------------------------------
-- Diagnóstico READ-ONLY — registros suspeitos relacionados ao BLOCKER PR #14
-- Nenhum dado é alterado. Uma única consulta final (o CLI exibe só o último
-- resultset).
-- ---------------------------------------------------------------------------

select
  (select count(*) from public.crm_leads) as total_leads,
  (select count(*) from public.people) as total_people,
  (select count(*) from (select phone from public.people where phone is not null group by phone having count(*) > 1) d) as telephones_duplicados,
  (select count(*) from (select whatsapp from public.people where whatsapp is not null group by whatsapp having count(*) > 1) d) as whatsapps_duplicados,
  (select count(*) from (select lower(email) e from public.people where email is not null group by lower(email) having count(*) > 1) d) as emails_duplicados,
  (select coalesce(jsonb_agg(x), '[]'::jsonb) from (
    select p1.id as person_1, p1.full_name as name_1,
           p2.id as person_2, p2.full_name as name_2,
           p1.phone as shared_phone
      from public.people p1
      join public.people p2 on p2.phone = p1.phone and p2.id <> p1.id and p1.phone is not null
     order by p1.phone limit 30
  ) x) as pares_telefone,
  (select coalesce(jsonb_agg(x), '[]'::jsonb) from (
    select p1.id as person_1, p1.full_name as name_1,
           p2.id as person_2, p2.full_name as name_2,
           p1.whatsapp as shared_whatsapp
      from public.people p1
      join public.people p2 on p2.whatsapp = p1.whatsapp and p2.id <> p1.id and p1.whatsapp is not null
     order by p1.whatsapp limit 30
  ) x) as pares_whatsapp,
  (select coalesce(jsonb_agg(x), '[]'::jsonb) from (
    select l.lead_code, l.id as lead_id, l.person_id, p.full_name as person_name, l.created_at as lead_created_at
      from public.crm_leads l
      join public.people p on p.id = l.person_id
     where (
           p.phone is not null and exists (select 1 from public.people p2 where p2.phone = p.phone and p2.id <> p.id)
        or p.whatsapp is not null and exists (select 1 from public.people p2 where p2.whatsapp = p.whatsapp and p2.id <> p.id)
        or p.email is not null and exists (select 1 from public.people p2 where lower(p2.email) = lower(p.email) and p2.id <> p.id)
       )
     order by l.created_at desc limit 50
  ) x) as leads_com_person_contato_compartilhado,
  (select coalesce(jsonb_agg(x), '[]'::jsonb) from (
    select l.person_id, count(*) as leads_count
      from public.crm_leads l
     group by l.person_id
    having count(*) > 1
     order by leads_count desc limit 30
  ) x) as pessoas_com_mais_de_um_lead;