-- Enable pg_cron extension (if not already enabled)
create extension if not exists pg_cron;

-- Schedule a job to delete notifications older than 48 hours, runs every hour
select cron.schedule(
  'delete-old-notifications',
  '0 * * * *',
  $$
    delete from notifications
    where created_at < now() - interval '48 hours';
  $$
);
