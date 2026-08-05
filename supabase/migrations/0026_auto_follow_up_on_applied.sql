-- When a job first reaches "applied", seed a gentle follow-up reminder one
-- week out if the user has not already chosen a follow-up date manually.
create or replace function jobs_stamp_status_dates()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'applied' and new.date_applied is null then
    new.date_applied = now();
  end if;

  if new.status = 'applied' and new.follow_up_date is null then
    new.follow_up_date = current_date + 7;
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
