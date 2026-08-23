-- Add line-level partial POS refunds and persisted cashier variance.
DROP INDEX IF EXISTS sales_returns_invoice_id_key;
ALTER TABLE sales_returns DROP CONSTRAINT IF EXISTS sales_returns_invoice_id_key;
ALTER TABLE sales_returns ADD COLUMN idempotency_key VARCHAR(120);
CREATE UNIQUE INDEX sales_returns_tenant_id_idempotency_key_key ON sales_returns(tenant_id,idempotency_key);
CREATE INDEX sales_returns_tenant_id_invoice_id_created_at_idx ON sales_returns(tenant_id,invoice_id,created_at);

CREATE TABLE sales_return_items (
  id UUID NOT NULL,
  return_id UUID NOT NULL,
  invoice_item_id UUID NOT NULL,
  product_id UUID NOT NULL,
  quantity DECIMAL(20,4) NOT NULL,
  net_amount DECIMAL(20,4) NOT NULL,
  tax_amount DECIMAL(20,4) NOT NULL,
  cost_amount DECIMAL(20,4) NOT NULL,
  total_amount DECIMAL(20,4) NOT NULL,
  CONSTRAINT sales_return_items_pkey PRIMARY KEY(id),
  CONSTRAINT sales_return_items_positive_quantity CHECK(quantity>0),
  CONSTRAINT sales_return_items_nonnegative_amounts CHECK(net_amount>=0 AND tax_amount>=0 AND cost_amount>=0 AND total_amount>=0),
  CONSTRAINT sales_return_items_return_id_fkey FOREIGN KEY(return_id) REFERENCES sales_returns(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT sales_return_items_invoice_item_id_fkey FOREIGN KEY(invoice_item_id) REFERENCES sales_invoice_items(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT sales_return_items_product_id_fkey FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX sales_return_items_return_id_idx ON sales_return_items(return_id);
CREATE INDEX sales_return_items_invoice_item_id_idx ON sales_return_items(invoice_item_id);

ALTER TABLE sales_return_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_return_items FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON sales_return_items
USING (EXISTS(SELECT 1 FROM sales_returns r WHERE r.id=return_id AND r.tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid))
WITH CHECK (EXISTS(SELECT 1 FROM sales_returns r WHERE r.id=return_id AND r.tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid));

ALTER TABLE cashier_shifts ADD COLUMN cash_variance DECIMAL(20,4);
