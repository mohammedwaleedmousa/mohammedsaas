CREATE TABLE "expense_categories" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "account_code" VARCHAR(20) NOT NULL,
  CONSTRAINT "expense_categories_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "expense_categories_tenant_id_name_key" UNIQUE ("tenant_id", "name")
);

CREATE TABLE "expenses" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "branch_id" UUID NOT NULL,
  "category_id" UUID NOT NULL,
  "amount" DECIMAL(20,4) NOT NULL,
  "tax" DECIMAL(20,4) DEFAULT 0 NOT NULL,
  "currency" VARCHAR(3) NOT NULL,
  "payment_method" payment_method NOT NULL,
  "account_code" VARCHAR(20) NOT NULL,
  "vendor" VARCHAR(180),
  "description" TEXT,
  "attachment_url" TEXT,
  "occurred_at" TIMESTAMPTZ(6) NOT NULL,
  "created_by_id" UUID,
  CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "chart_of_accounts" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "code" VARCHAR(20) NOT NULL,
  "name_ar" VARCHAR(160) NOT NULL,
  "name_en" VARCHAR(160),
  "type" account_type NOT NULL,
  "parent_id" UUID,
  "active" BOOLEAN DEFAULT TRUE NOT NULL,
  CONSTRAINT "chart_of_accounts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "chart_of_accounts_tenant_id_code_key" UNIQUE ("tenant_id", "code")
);

CREATE TABLE "journal_entries" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "number" VARCHAR(40) NOT NULL,
  "status" journal_status DEFAULT 'DRAFT' NOT NULL,
  "entry_date" DATE NOT NULL,
  "currency" VARCHAR(3) NOT NULL,
  "description" VARCHAR(260) NOT NULL,
  "source_type" VARCHAR(60),
  "source_id" UUID,
  "reversed_entry_id" UUID,
  "posted_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  CONSTRAINT "journal_entries_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "journal_entries_tenant_id_number_key" UNIQUE ("tenant_id", "number"),
  CONSTRAINT "journal_entries_tenant_id_source_type_source_id_key" UNIQUE ("tenant_id", "source_type", "source_id")
);

CREATE TABLE "journal_lines" (
  "id" UUID NOT NULL,
  "journal_id" UUID NOT NULL,
  "account_id" UUID NOT NULL,
  "debit" DECIMAL(20,4) DEFAULT 0 NOT NULL,
  "credit" DECIMAL(20,4) DEFAULT 0 NOT NULL,
  "memo" TEXT,
  CONSTRAINT "journal_lines_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "fiscal_years" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "name" VARCHAR(80) NOT NULL,
  "starts_on" DATE NOT NULL,
  "ends_on" DATE NOT NULL,
  CONSTRAINT "fiscal_years_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "fiscal_years_tenant_id_name_key" UNIQUE ("tenant_id", "name")
);

CREATE TABLE "fiscal_periods" (
  "id" UUID NOT NULL,
  "fiscal_year_id" UUID NOT NULL,
  "name" VARCHAR(80) NOT NULL,
  "starts_on" DATE NOT NULL,
  "ends_on" DATE NOT NULL,
  "closed" BOOLEAN DEFAULT FALSE NOT NULL,
  "closed_at" TIMESTAMPTZ(6),
  CONSTRAINT "fiscal_periods_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "fiscal_periods_fiscal_year_id_name_key" UNIQUE ("fiscal_year_id", "name")
);

CREATE TABLE "cashier_shifts" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "branch_id" UUID NOT NULL,
  "opened_by_id" UUID NOT NULL,
  "closed_by_id" UUID,
  "status" shift_status DEFAULT 'OPEN' NOT NULL,
  "opening_cash" DECIMAL(20,4) NOT NULL,
  "expected_cash" DECIMAL(20,4),
  "counted_cash" DECIMAL(20,4),
  "opened_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "closed_at" TIMESTAMPTZ(6),
  CONSTRAINT "cashier_shifts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "pos_transactions" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "branch_id" UUID NOT NULL,
  "shift_id" UUID NOT NULL,
  "invoice_id" UUID NOT NULL,
  "total" DECIMAL(20,4) NOT NULL,
  "method" payment_method NOT NULL,
  "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  CONSTRAINT "pos_transactions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "pos_transactions_invoice_id_key" UNIQUE ("invoice_id")
);

CREATE TABLE "notifications" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "user_id" UUID,
  "type" VARCHAR(80) NOT NULL,
  "title" VARCHAR(180) NOT NULL,
  "body" TEXT,
  "read_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "audit_logs" (
  "id" UUID NOT NULL,
  "tenant_id" UUID,
  "actor_id" UUID,
  "action" VARCHAR(120) NOT NULL,
  "entity_type" VARCHAR(80),
  "entity_id" UUID,
  "branch_id" UUID,
  "metadata" JSONB DEFAULT '{}'::jsonb NOT NULL,
  "ip_hash" VARCHAR(128),
  "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "feature_flags" (
  "id" UUID NOT NULL,
  "key" VARCHAR(100) NOT NULL,
  "description" TEXT,
  "enabled" BOOLEAN DEFAULT FALSE NOT NULL,
  "scope" feature_flag_scope DEFAULT 'GLOBAL' NOT NULL,
  CONSTRAINT "feature_flags_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "feature_flags_key_key" UNIQUE ("key")
);

CREATE TABLE "tenant_feature_flags" (
  "tenant_id" UUID NOT NULL,
  "flag_id" UUID NOT NULL,
  "enabled" BOOLEAN NOT NULL,
  CONSTRAINT "tenant_feature_flags_pkey" PRIMARY KEY ("tenant_id", "flag_id")
);

CREATE TABLE "tenant_sequences" (
  "tenant_id" UUID NOT NULL,
  "key" VARCHAR(40) NOT NULL,
  "value" BIGINT DEFAULT 0 NOT NULL,
  CONSTRAINT "tenant_sequences_pkey" PRIMARY KEY ("tenant_id", "key")
);
