CREATE TYPE membership_status AS ENUM ('INVITED', 'ACTIVE', 'SUSPENDED', 'REMOVED');

CREATE TYPE subscription_status AS ENUM ('TRIAL', 'ACTIVE', 'PAST_DUE', 'GRACE_PERIOD', 'READ_ONLY', 'SUSPENDED', 'CANCELLED');

CREATE TYPE billing_provider AS ENUM ('MANUAL', 'STRIPE', 'REGIONAL');

CREATE TYPE invoice_status AS ENUM ('DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED', 'REFUNDED');

CREATE TYPE purchase_status AS ENUM ('DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'CANCELLED', 'REFUNDED');

CREATE TYPE journal_status AS ENUM ('DRAFT', 'POSTED', 'REVERSED');

CREATE TYPE account_type AS ENUM ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE');

CREATE TYPE inventory_direction AS ENUM ('IN', 'OUT');

CREATE TYPE inventory_movement_type AS ENUM ('OPENING_BALANCE', 'PURCHASE', 'SALE', 'SALE_RETURN', 'PURCHASE_RETURN', 'TRANSFER_IN', 'TRANSFER_OUT', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'DAMAGE');

CREATE TYPE payment_method AS ENUM ('CASH', 'CARD', 'BANK_TRANSFER', 'OTHER');

CREATE TYPE shift_status AS ENUM ('OPEN', 'CLOSED');

CREATE TYPE feature_flag_scope AS ENUM ('GLOBAL', 'PLAN', 'TENANT');

CREATE TABLE "users" (
  "id" UUID NOT NULL,
  "auth_user_id" UUID NOT NULL,
  "email" VARCHAR(320),
  "display_name" VARCHAR(160),
  "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "users_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "users_auth_user_id_key" UNIQUE ("auth_user_id")
);

CREATE TABLE "tenants" (
  "id" UUID NOT NULL,
  "slug" VARCHAR(80) NOT NULL,
  "name" VARCHAR(180) NOT NULL,
  "industry" VARCHAR(120),
  "country" VARCHAR(2) NOT NULL,
  "base_currency" VARCHAR(3) NOT NULL,
  "timezone" VARCHAR(80) DEFAULT 'Asia/Aden' NOT NULL,
  "language" VARCHAR(8) DEFAULT 'ar' NOT NULL,
  "phone" VARCHAR(40),
  "email" VARCHAR(320),
  "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "tenants_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "tenants_slug_key" UNIQUE ("slug")
);

CREATE TABLE "tenant_settings" (
  "tenant_id" UUID NOT NULL,
  "logo_url" TEXT,
  "tax_enabled" BOOLEAN DEFAULT FALSE NOT NULL,
  "default_tax_rate" DECIMAL(7,4) DEFAULT 0 NOT NULL,
  "fiscal_year_start" INTEGER DEFAULT 1 NOT NULL,
  CONSTRAINT "tenant_settings_pkey" PRIMARY KEY ("tenant_id")
);

CREATE TABLE "memberships" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "status" membership_status DEFAULT 'ACTIVE' NOT NULL,
  "invited_email" VARCHAR(320),
  "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  CONSTRAINT "memberships_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "memberships_tenant_id_user_id_key" UNIQUE ("tenant_id", "user_id")
);

CREATE TABLE "membership_invitations" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "email" VARCHAR(320) NOT NULL,
  "token_hash" VARCHAR(64) NOT NULL,
  "role_ids" JSONB NOT NULL,
  "branch_ids" JSONB NOT NULL,
  "invited_by_id" UUID NOT NULL,
  "expires_at" TIMESTAMPTZ(6) NOT NULL,
  "accepted_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  CONSTRAINT "membership_invitations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "membership_invitations_token_hash_key" UNIQUE ("token_hash")
);

CREATE TABLE "roles" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "name" VARCHAR(80) NOT NULL,
  "is_system" BOOLEAN DEFAULT FALSE NOT NULL,
  CONSTRAINT "roles_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "roles_tenant_id_name_key" UNIQUE ("tenant_id", "name")
);

CREATE TABLE "permissions" (
  "id" UUID NOT NULL,
  "key" VARCHAR(120) NOT NULL,
  "description" VARCHAR(240),
  CONSTRAINT "permissions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "permissions_key_key" UNIQUE ("key")
);

CREATE TABLE "role_permissions" (
  "role_id" UUID NOT NULL,
  "permission_id" UUID NOT NULL,
  CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id", "permission_id")
);

CREATE TABLE "membership_roles" (
  "membership_id" UUID NOT NULL,
  "role_id" UUID NOT NULL,
  CONSTRAINT "membership_roles_pkey" PRIMARY KEY ("membership_id", "role_id")
);

CREATE TABLE "membership_branches" (
  "membership_id" UUID NOT NULL,
  "branch_id" UUID NOT NULL,
  CONSTRAINT "membership_branches_pkey" PRIMARY KEY ("membership_id", "branch_id")
);

CREATE TABLE "branches" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "name" VARCHAR(140) NOT NULL,
  "code" VARCHAR(30) NOT NULL,
  "active" BOOLEAN DEFAULT TRUE NOT NULL,
  "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  CONSTRAINT "branches_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "branches_tenant_id_code_key" UNIQUE ("tenant_id", "code")
);

CREATE TABLE "subscription_plans" (
  "id" UUID NOT NULL,
  "code" VARCHAR(40) NOT NULL,
  "name" VARCHAR(100) NOT NULL,
  "monthly_price" DECIMAL(20,4) NOT NULL,
  "currency" VARCHAR(3) NOT NULL,
  "max_branches" INTEGER,
  "max_users" INTEGER,
  "active" BOOLEAN DEFAULT TRUE NOT NULL,
  "entitlements" JSONB DEFAULT '{}'::jsonb NOT NULL,
  CONSTRAINT "subscription_plans_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "subscription_plans_code_key" UNIQUE ("code")
);

CREATE TABLE "subscriptions" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "plan_id" UUID NOT NULL,
  "status" subscription_status DEFAULT 'TRIAL' NOT NULL,
  "provider" billing_provider DEFAULT 'MANUAL' NOT NULL,
  "trial_ends_at" TIMESTAMPTZ(6),
  "current_period_ends_at" TIMESTAMPTZ(6),
  "grace_ends_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "subscriptions_tenant_id_key" UNIQUE ("tenant_id")
);

CREATE TABLE "subscription_events" (
  "id" UUID NOT NULL,
  "subscription_id" UUID NOT NULL,
  "type" VARCHAR(80) NOT NULL,
  "metadata" JSONB DEFAULT '{}'::jsonb NOT NULL,
  "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  CONSTRAINT "subscription_events_pkey" PRIMARY KEY ("id")
);
