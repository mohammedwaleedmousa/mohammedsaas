-- Reconcile the preserved SQL baseline enum names with the Prisma schema names.
-- Earlier migrations intentionally remain unchanged; this migration makes the final database
-- shape match prisma/schema.prisma after the integrity/security migrations have run.
ALTER TYPE membership_status RENAME TO "MembershipStatus";
ALTER TYPE subscription_status RENAME TO "SubscriptionStatus";
ALTER TYPE billing_provider RENAME TO "BillingProvider";
ALTER TYPE invoice_status RENAME TO "InvoiceStatus";
ALTER TYPE purchase_status RENAME TO "PurchaseStatus";
ALTER TYPE journal_status RENAME TO "JournalStatus";
ALTER TYPE account_type RENAME TO "AccountType";
ALTER TYPE inventory_direction RENAME TO "InventoryDirection";
ALTER TYPE inventory_movement_type RENAME TO "InventoryMovementType";
ALTER TYPE payment_method RENAME TO "PaymentMethod";
ALTER TYPE shift_status RENAME TO "ShiftStatus";
ALTER TYPE feature_flag_scope RENAME TO "FeatureFlagScope";

-- PL/pgSQL stores the function body as text. Recreate functions that named journal_status
-- so they compile against the renamed enum on fresh databases and after deployment.
CREATE OR REPLACE FUNCTION protect_posted_journal_lines() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE s "JournalStatus";
BEGIN
  SELECT status INTO s FROM journal_entries WHERE id=COALESCE(OLD.journal_id,NEW.journal_id);
  IF s IN ('POSTED','REVERSED') THEN RAISE EXCEPTION 'Posted/reversed journal lines are immutable'; END IF;
  RETURN COALESCE(NEW,OLD);
END $$;

CREATE OR REPLACE FUNCTION enforce_balanced_journal_line() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE target uuid; s "JournalStatus"; d numeric; c numeric;
BEGIN
  target := CASE WHEN TG_OP='DELETE' THEN OLD.journal_id ELSE NEW.journal_id END;
  SELECT status INTO s FROM journal_entries WHERE id=target;
  IF s IN ('POSTED','REVERSED') THEN
    SELECT COALESCE(SUM(debit),0),COALESCE(SUM(credit),0) INTO d,c FROM journal_lines WHERE journal_id=target;
    IF d <> c THEN RAISE EXCEPTION 'Posted journal % is not balanced (% != %)',target,d,c; END IF;
  END IF;
  RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $$;
