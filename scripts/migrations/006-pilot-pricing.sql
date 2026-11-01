-- Preserve historical invoice quotes; lower prices apply only to newly created invoices.
ALTER TABLE portova_crypto_invoices DROP CONSTRAINT IF EXISTS portova_crypto_invoices_amount_check;
ALTER TABLE portova_crypto_invoices ADD CONSTRAINT portova_crypto_invoices_amount_check
  CHECK(amount IN (19000000,49000000,149000000));
