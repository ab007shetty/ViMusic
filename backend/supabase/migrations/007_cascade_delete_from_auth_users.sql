-- 007_cascade_delete_from_auth_users.sql
-- Chains auth.users deletion into the public.users cascade added in
-- migration 006. Without this, deleting a user from the Supabase
-- dashboard's Authentication → Users screen (which only touches
-- auth.users) left an orphaned public.users row and all of that user's
-- app data untouched — migration 002 only ever synced auth.users into
-- public.users on INSERT/UPDATE, never on DELETE.
--
-- public.users.id is populated as auth.users.id verbatim (see migration
-- 002's handle_auth_user_change trigger, `NEW.id`), so this matches on id.
--
-- Result: deleting a user from Authentication → Users now deletes their
-- public.users row, which in turn fires 006's on_user_deleted_cascade
-- trigger and wipes their data from every other table. Same
-- irreversibility warning as migration 006 applies here.

CREATE OR REPLACE FUNCTION public.cascade_delete_from_auth_user()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM public.users WHERE id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_deleted_cascade ON auth.users;

CREATE TRIGGER on_auth_user_deleted_cascade
  AFTER DELETE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.cascade_delete_from_auth_user();
