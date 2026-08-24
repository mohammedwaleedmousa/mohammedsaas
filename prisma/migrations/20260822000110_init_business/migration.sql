CREATE TABLE "payments" (
  "id" UUID NOT NULL,
  "subscription_id" UUID NOT NULL,
  "provider" billing_provider NOT NULL,
  "external_ref" VARCHAR(160),
  "amount" DECIMAL(20,4) NOT NULL,
  "currency" VARCHAR(3) NOT NULL,
  "received_at" TIMESTAMPTZ(6) NOT NULL,
  "metadata" JSONB DEFAULT '{}'::jsonb NOT NULL,
  CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "customers" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "name" VARCHAR(180) NOT NULL,
  "phone" VARCHAR(40),
  "email" VARCHAR(320),
  "tax_number" VARCHAR(80),
  "address" TEXT,
  "credit_limit" DECIMAL(20,4) DEFAULT 0 NOT NULL,
  "active" BOOLEAN DEFAULT TRUE NOT NULL,
  "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "suppliers" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "name" VARCHAR(180) NOT NULL,
  "phone" VARCHAR(40),
  "email" VARCHAR(320),
  "tax_number" VARCHAR(80),
  "address" TEXT,
  "active" BOOLEAN DEFAULT TRUE NOT NULL,
  "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "product_categories" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "active" BOOLEAN DEFAULT TRUE NOT NULL,
  CONSTRAINT "product_categories_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "product_categories_tenant_id_name_key" UNIQUE ("tenant_id", "name")
);

CREATE TABLE "products" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "category_id" UUID,
  "sku" VARCHAR(80) NOT NULL,
  "barcode" VARCHAR(120),
  "name" VARCHAR(180) NOT NULL,
  "description" TEXT,
  "unit" VARCHAR(40) DEFAULT 'piece' NOT NULL,
  "cost_price" DECIMAL(20,4) NOT NULL,
  "selling_price" DECIMAL(20,4) NOT NULL,
  "tax_rate" DECIMAL(7,4) DEFAULT 0 NOT NULL,
  "track_inventory" BOOLEAN DEFAULT TRUE NOT NULL,
  "minimum_stock" DECIMAL(20,4) DEFAULT 0 NOT NULL,
  "active" BOOLEAN DEFAULT TRUE NOT NULL,
  "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "products_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "products_tenant_id_sku_key" UNIQUE ("tenant_id", "sku"),
  CONSTRAINT "products_tenant_id_barcode_key" UNIQUE ("tenant_id", "barcode")
);

CREATE TABLE "warehouses" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "branch_id" UUID NOT NULL,
  "name" VARCHAR(140) NOT NULL,
  "code" VARCHAR(30) NOT NULL,
  "active" BOOLEAN DEFAULT TRUE NOT NULL,
  CONSTRAINT "warehouses_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "warehouses_tenant_id_code_key" UNIQUE ("tenant_id", "code")
);

CREATE TABLE "inventory_movements" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "branch_id" UUID NOT NULL,
  "warehouse_id" UUID NOT NULL,
  "product_id" UUID NOT NULL,
  "quantity" DECIMAL(20,4) NOT NULL,
  "direction" inventory_direction NOT NULL,
  "type" inventory_movement_type NOT NULL,
  "reference_type" VARCHAR(60),
  "reference_id" UUID,
  "reason" TEXT,
  "created_by_id" UUID,
  "occurred_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  CONSTRAINT "inventory_movements_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sales_invoices" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "branch_id" UUID NOT NULL,
  "customer_id" UUID,
  "number" VARCHAR(40) NOT NULL,
  "status" invoice_status DEFAULT 'DRAFT' NOT NULL,
  "currency" VARCHAR(3) NOT NULL,
  "subtotal" DECIMAL(20,4) NOT NULL,
  "discount_total" DECIMAL(20,4) DEFAULT 0 NOT NULL,
  "tax_total" DECIMAL(20,4) DEFAULT 0 NOT NULL,
  "total" DECIMAL(20,4) NOT NULL,
  "paid_amount" DECIMAL(20,4) DEFAULT 0 NOT NULL,
  "due_date" DATE,
  "notes" TEXT,
  "idempotency_key" VARCHAR(120),
  "posted_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "created_by_id" UUID,
  CONSTRAINT "sales_invoices_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "sales_invoices_tenant_id_number_key" UNIQUE ("tenant_id", "number"),
  CONSTRAINT "sales_invoices_tenant_id_idempotency_key_key" UNIQUE ("tenant_id", "idempotency_key")
);

CREATE TABLE "sales_invoice_items" (
  "id" UUID NOT NULL,
  "invoice_id" UUID NOT NULL,
  "product_id" UUID NOT NULL,
  "description" VARCHAR(220) NOT NULL,
  "quantity" DECIMAL(20,4) NOT NULL,
  "unit_price" DECIMAL(20,4) NOT NULL,
  "unit_cost" DECIMAL(20,4) NOT NULL,
  "discount" DECIMAL(20,4) DEFAULT 0 NOT NULL,
  "tax" DECIMAL(20,4) DEFAULT 0 NOT NULL,
  "line_total" DECIMAL(20,4) NOT NULL,
  CONSTRAINT "sales_invoice_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sales_returns" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "branch_id" UUID NOT NULL,
  "invoice_id" UUID NOT NULL,
  "shift_id" UUID,
  "amount" DECIMAL(20,4) NOT NULL,
  "currency" VARCHAR(3) NOT NULL,
  "method" payment_method NOT NULL,
  "reason" TEXT,
  "created_by_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  CONSTRAINT "sales_returns_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "sales_returns_invoice_id_key" UNIQUE ("invoice_id")
);

CREATE TABLE "customer_payments" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "customer_id" UUID,
  "invoice_id" UUID,
  "amount" DECIMAL(20,4) NOT NULL,
  "currency" VARCHAR(3) NOT NULL,
  "method" payment_method NOT NULL,
  "account_code" VARCHAR(20) NOT NULL,
  "received_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "customer_payments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "purchase_bills" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "branch_id" UUID NOT NULL,
  "supplier_id" UUID NOT NULL,
  "number" VARCHAR(40) NOT NULL,
  "status" purchase_status DEFAULT 'DRAFT' NOT NULL,
  "currency" VARCHAR(3) NOT NULL,
  "subtotal" DECIMAL(20,4) NOT NULL,
  "tax_total" DECIMAL(20,4) DEFAULT 0 NOT NULL,
  "total" DECIMAL(20,4) NOT NULL,
  "paid_amount" DECIMAL(20,4) DEFAULT 0 NOT NULL,
  "posted_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  CONSTRAINT "purchase_bills_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "purchase_bills_tenant_id_number_key" UNIQUE ("tenant_id", "number")
);

CREATE TABLE "purchase_bill_items" (
  "id" UUID NOT NULL,
  "bill_id" UUID NOT NULL,
  "product_id" UUID NOT NULL,
  "description" VARCHAR(220) NOT NULL,
  "quantity" DECIMAL(20,4) NOT NULL,
  "unit_cost" DECIMAL(20,4) NOT NULL,
  "tax" DECIMAL(20,4) DEFAULT 0 NOT NULL,
  "line_total" DECIMAL(20,4) NOT NULL,
  CONSTRAINT "purchase_bill_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "supplier_payments" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "supplier_id" UUID NOT NULL,
  "bill_id" UUID,
  "amount" DECIMAL(20,4) NOT NULL,
  "currency" VARCHAR(3) NOT NULL,
  "method" payment_method NOT NULL,
  "account_code" VARCHAR(20) NOT NULL,
  "paid_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "supplier_payments_pkey" PRIMARY KEY ("id")
);
