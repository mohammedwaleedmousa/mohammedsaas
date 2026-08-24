-- Correct deferred journal balance checks without rewriting preserved migration history.
DROP TRIGGER IF EXISTS journal_entry_balanced ON journal_entries;
DROP TRIGGER IF EXISTS journal_line_balanced ON journal_lines;
DROP FUNCTION IF EXISTS enforce_balanced_journal();

CREATE OR REPLACE FUNCTION enforce_balanced_journal_entry() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE d numeric; c numeric;
BEGIN
  IF NEW.status IN ('POSTED','REVERSED') THEN
    SELECT COALESCE(SUM(debit),0),COALESCE(SUM(credit),0) INTO d,c FROM journal_lines WHERE journal_id=NEW.id;
    IF d <> c THEN RAISE EXCEPTION 'Posted journal % is not balanced (% != %)',NEW.id,d,c; END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION enforce_balanced_journal_line() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE target uuid; s journal_status; d numeric; c numeric;
BEGIN
  target := CASE WHEN TG_OP='DELETE' THEN OLD.journal_id ELSE NEW.journal_id END;
  SELECT status INTO s FROM journal_entries WHERE id=target;
  IF s IN ('POSTED','REVERSED') THEN
    SELECT COALESCE(SUM(debit),0),COALESCE(SUM(credit),0) INTO d,c FROM journal_lines WHERE journal_id=target;
    IF d <> c THEN RAISE EXCEPTION 'Posted journal % is not balanced (% != %)',target,d,c; END IF;
  END IF;
  RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $$;

CREATE CONSTRAINT TRIGGER journal_entry_balanced
AFTER INSERT OR UPDATE OF status ON journal_entries
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION enforce_balanced_journal_entry();

CREATE CONSTRAINT TRIGGER journal_line_balanced
AFTER INSERT OR UPDATE OR DELETE ON journal_lines
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION enforce_balanced_journal_line();

-- The invitation token is high-entropy and only this narrow lookup may bypass tenant RLS before tenant context exists.
CREATE OR REPLACE FUNCTION resolve_membership_invitation(p_token_hash text,p_email text)
RETURNS TABLE(id uuid,tenant_id uuid,email varchar,role_ids jsonb,branch_ids jsonb)
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path=pg_catalog,public
AS $$
  SELECT i.id,i.tenant_id,i.email,i.role_ids,i.branch_ids
  FROM public.membership_invitations i
  WHERE i.token_hash=p_token_hash
    AND lower(i.email)=lower(p_email)
    AND i.accepted_at IS NULL
    AND i.expires_at > now()
  LIMIT 1
$$;
REVOKE ALL ON FUNCTION resolve_membership_invitation(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION resolve_membership_invitation(text,text) TO PUBLIC;

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON audit_logs;
CREATE POLICY tenant_isolation ON audit_logs
USING (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid)
WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid);

CREATE OR REPLACE FUNCTION protect_audit_log() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Audit logs are immutable';
END $$;
DROP TRIGGER IF EXISTS audit_logs_immutable ON audit_logs;
CREATE TRIGGER audit_logs_immutable BEFORE UPDATE OR DELETE ON audit_logs
FOR EACH ROW EXECUTE FUNCTION protect_audit_log();
