alter table settings
  add column if not exists default_application_follow_up_days smallint,
  drop constraint if exists settings_default_application_follow_up_days_check,
  add constraint settings_default_application_follow_up_days_check
    check (
      default_application_follow_up_days is null
      or default_application_follow_up_days in (3, 5, 7, 10, 14)
    );

update settings
set default_application_follow_up_days = 7
where default_application_follow_up_days is null;

alter table settings
  alter column default_application_follow_up_days set default 7;

create or replace function jobs_stamp_status_dates()
returns trigger
language plpgsql
as $$
declare
  follow_up_days smallint;
begin
  if new.status = 'applied' and new.date_applied is null then
    new.date_applied = now();
  end if;

  if new.status = 'applied' and new.follow_up_date is null then
    select s.default_application_follow_up_days
      into follow_up_days
    from settings s
    where s.user_id = new.user_id;

    if follow_up_days is not null then
      new.follow_up_date = (new.date_applied at time zone 'utc')::date + follow_up_days;
    end if;
  end if;

  if new.status in ('interview', 'final_interview', 'offer', 'rejected', 'closed', 'ghosted', 'archived') then
    new.follow_up_date = null;
  end if;

  if new.status in ('interview', 'final_interview') and new.interview_date is null then
    new.interview_date = now();
  end if;

  if new.status = 'offer' and new.offer_date is null then
    new.offer_date = now();
  end if;

  if new.status = 'rejected' and new.rejection_date is null then
    new.rejection_date = now();
  end if;

  return new;
end;
$$;
