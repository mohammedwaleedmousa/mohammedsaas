-- Financial and tenant-integrity hardening applied after Prisma's baseline schema.
ALTER TABLE journal_lines ADD CONSTRAINT journal_lines_nonnegative CHECK (debit >= 0 AND credit >= 0);
ALTER TABLE journal_lines ADD CONSTRAINT journal_lines_one_sided CHECK ((debit > 0 AND credit = 0) OR (credit > 0 AND debit = 0));
ALTER TABLE inventory_movements ADD CONSTRAINT inventory_movements_positive_quantity CHECK (quantity > 0);
ALTER TABLE sales_invoice_items ADD CONSTRAINT sales_invoice_items_positive_quantity CHECK (quantity > 0);
ALTER TABLE purchase_bill_items ADD CONSTRAINT purchase_bill_items_positive_quantity CHECK (quantity > 0);

CREATE OR REPLACE FUNCTION enforce_balanced_journal() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE target uuid; s journal_status; d numeric; c numeric;
BEGIN
  target := COALESCE(NEW.id, NEW.journal_id, OLD.id, OLD.journal_id);
  SELECT status INTO s FROM journal_entries WHERE id=target;
  IF s IN ('POSTED','REVERSED') THEN
    SELECT COALESCE(SUM(debit),0),COALESCE(SUM(credit),0) INTO d,c FROM journal_lines WHERE journal_id=target;
    IF d <> c THEN RAISE EXCEPTION 'Posted journal % is not balanced (% != %)',target,d,c; END IF;
  END IF;
  RETURN COALESCE(NEW,OLD);
END $$;

CREATE CONSTRAINT TRIGGER journal_entry_balanced AFTER INSERT OR UPDATE OF status ON journal_entries DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION enforce_balanced_journal();
CREATE CONSTRAINT TRIGGER journal_line_balanced AFTER INSERT OR UPDATE OR DELETE ON journal_lines DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION enforce_balanced_journal();

CREATE OR REPLACE FUNCTION protect_posted_journal_lines() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE s journal_status;
BEGIN
  SELECT status INTO s FROM journal_entries WHERE id=COALESCE(OLD.journal_id,NEW.journal_id);
  IF s IN ('POSTED','REVERSED') THEN RAISE EXCEPTION 'Posted/reversed journal lines are immutable'; END IF;
  RETURN COALESCE(NEW,OLD);
END $$;
CREATE TRIGGER journal_lines_immutable BEFORE UPDATE OR DELETE ON journal_lines FOR EACH ROW EXECUTE FUNCTION protect_posted_journal_lines();

CREATE OR REPLACE FUNCTION protect_posted_journal_entry() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status IN ('POSTED','REVERSED') THEN
    IF NOT (OLD.status='POSTED' AND NEW.status='REVERSED' AND NEW.reversed_entry_id IS DISTINCT FROM OLD.reversed_entry_id
      AND NEW.number=OLD.number AND NEW.entry_date=OLD.entry_date AND NEW.currency=OLD.currency AND NEW.description=OLD.description
      AND NEW.source_type IS NOT DISTINCT FROM OLD.source_type AND NEW.source_id IS NOT DISTINCT FROM OLD.source_id) THEN
      RAISE EXCEPTION 'Posted/reversed journals may only transition POSTED -> REVERSED';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER journal_entries_immutable BEFORE UPDATE ON journal_entries FOR EACH ROW EXECUTE FUNCTION protect_posted_journal_entry();

-- RLS is defense in depth. API still scopes every business query by tenant + membership + branch.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'branches','roles','membership_invitations','customers','suppliers','product_categories','products','warehouses',
    'inventory_movements','sales_invoices','sales_returns','customer_payments','purchase_bills','supplier_payments',
    'expense_categories','expenses','chart_of_accounts','journal_entries','fiscal_years','cashier_shifts','pos_transactions',
    'notifications','tenant_feature_flags','tenant_sequences'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
    EXECUTE format('CREATE POLICY tenant_isolation ON %I USING (tenant_id = nullif(current_setting(''app.tenant_id'', true), '''')::uuid) WITH CHECK (tenant_id = nullif(current_setting(''app.tenant_id'', true), '''')::uuid)',t);
  END LOOP;
END $$;

-- Child tables without tenant_id inherit isolation through their parent.
ALTER TABLE sales_invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_invoice_items FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON sales_invoice_items USING (EXISTS(SELECT 1 FROM sales_invoices i WHERE i.id=invoice_id AND i.tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid)) WITH CHECK (EXISTS(SELECT 1 FROM sales_invoices i WHERE i.id=invoice_id AND i.tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid));
ALTER TABLE purchase_bill_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_bill_items FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON purchase_bill_items USING (EXISTS(SELECT 1 FROM purchase_bills b WHERE b.id=bill_id AND b.tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid)) WITH CHECK (EXISTS(SELECT 1 FROM purchase_bills b WHERE b.id=bill_id AND b.tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid));
ALTER TABLE journal_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_lines FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON journal_lines USING (EXISTS(SELECT 1 FROM journal_entries j WHERE j.id=journal_id AND j.tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid)) WITH CHECK (EXISTS(SELECT 1 FROM journal_entries j WHERE j.id=journal_id AND j.tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid));
