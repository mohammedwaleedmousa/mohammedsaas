# Accounting Engine

## Money arithmetic

`packages/accounting-engine` represents business amounts as decimal strings with four fractional digits. `decimalToUnits()` converts them to `bigint` fixed-scale units (`10^4`), and addition, subtraction, comparison, multiplication, and proration use integer arithmetic instead of JavaScript floating point.

Financial tests compare fixed-scale units, not `Number` values.

## Journal rules

`assertBalanced()` requires at least two lines, non-negative debit/credit values, exactly one non-zero side per line, and equal total debits and credits.

V1 journal builders include cash sale, credit sale, customer payment, inventory purchase on credit, supplier payment, expense payment, and sale refund.

## Accounts used by the V1 templates

The default workspace chart includes cash (`1100`), bank (`1200`), accounts receivable (`1300`), inventory (`1400`), accounts payable (`2100`), output VAT (`2200`), recoverable input VAT (`2210`), sales revenue (`4100`), cost of goods sold (`5000`), and operating expense (`6000`).

## POS refunds

A refund does **not** mutate or reverse the original POS sale journal. The original `POS_SALE` journal remains `POSTED`. Each partial return creates an independent `POS_REFUND` compensating journal based on the returned line quantities. Final-line proration absorbs prior fractional remainder so the complete return equals the original financial amount at four-decimal precision.

## Database enforcement

Application balance checks are reinforced by PostgreSQL constraints and deferred triggers. Posted journal lines are immutable. Accounting tests verify each sale/refund/purchase/payment/expense journal by summing fixed-scale debit and credit units.
