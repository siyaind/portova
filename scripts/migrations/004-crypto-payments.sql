CREATE TABLE IF NOT EXISTS portova_crypto_invoices (
  id uuid PRIMARY KEY,account varchar(64) NOT NULL,plan text NOT NULL CHECK(plan IN ('pro','team')),
  amount bigint NOT NULL CHECK(amount IN (49000000,149000000)),recipient varchar(42) NOT NULL,
  chain_id integer NOT NULL CHECK(chain_id=8453),token varchar(42) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),expires_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','pending','paid','review')),
  tx_hash varchar(66),payer varchar(42),proof text,paid_at timestamptz,block_number bigint,last_checked_at timestamptz,
  UNIQUE(chain_id,tx_hash)
);
CREATE INDEX IF NOT EXISTS portova_crypto_account ON portova_crypto_invoices(account,created_at DESC);
CREATE TABLE IF NOT EXISTS portova_crypto_terms (
  invoice_id uuid PRIMARY KEY REFERENCES portova_crypto_invoices(id),account varchar(64) NOT NULL,
  plan text NOT NULL CHECK(plan IN ('pro','team')),starts_at timestamptz NOT NULL,ends_at timestamptz NOT NULL CHECK(ends_at>starts_at)
);
CREATE INDEX IF NOT EXISTS portova_terms_account ON portova_crypto_terms(account,starts_at,ends_at);
CREATE OR REPLACE VIEW portova_entitlements AS
SELECT b.account,b.customer_id,b.subscription_id,b.checkout_request,b.checkout_expires,
 CASE WHEN EXISTS(SELECT 1 FROM portova_crypto_terms t WHERE t.account=b.account) THEN COALESCE(current_term.plan,'free') ELSE b.plan END AS plan,
 CASE WHEN EXISTS(SELECT 1 FROM portova_crypto_terms t WHERE t.account=b.account) THEN CASE WHEN current_term.plan IS NULL THEN 'inactive' ELSE 'active' END ELSE b.status END AS status,
 CASE WHEN EXISTS(SELECT 1 FROM portova_crypto_terms t WHERE t.account=b.account) THEN current_term.ends_at ELSE b.period_end END AS period_end,
 b.last_event_created,b.updated_at
FROM portova_billing b LEFT JOIN LATERAL(SELECT t.plan,t.ends_at FROM portova_crypto_terms t WHERE t.account=b.account AND t.starts_at<=now() AND t.ends_at>now() ORDER BY t.starts_at DESC LIMIT 1) current_term ON true;
CREATE OR REPLACE FUNCTION portova_credit_crypto(invoice uuid,hash text,sender text,paid_time timestamptz,height bigint) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE row_invoice portova_crypto_invoices%ROWTYPE; start_time timestamptz; end_time timestamptz; output jsonb;
BEGIN
 SELECT * INTO row_invoice FROM portova_crypto_invoices WHERE id=invoice FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'invoice_missing'; END IF;
 IF row_invoice.status='paid' THEN
   IF row_invoice.tx_hash<>hash THEN RAISE EXCEPTION 'invoice_already_paid'; END IF;
   SELECT jsonb_build_object('status','paid','startsAt',t.starts_at,'endsAt',t.ends_at,'plan',t.plan) INTO output FROM portova_crypto_terms t WHERE t.invoice_id=invoice;RETURN output;
 END IF;
 IF row_invoice.status<>'pending' OR row_invoice.tx_hash<>hash OR lower(row_invoice.payer)<>lower(sender) THEN RAISE EXCEPTION 'invoice_mismatch'; END IF;
 IF paid_time<date_trunc('second',row_invoice.created_at) OR paid_time>row_invoice.expires_at THEN RAISE EXCEPTION 'invoice_expired'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext(row_invoice.account));
 SELECT GREATEST(now(),COALESCE(max(t.ends_at),now())) INTO start_time FROM portova_crypto_terms t WHERE t.account=row_invoice.account;
 end_time:=start_time+interval '30 days';
 INSERT INTO portova_crypto_terms VALUES(invoice,row_invoice.account,row_invoice.plan,start_time,end_time);
 INSERT INTO portova_billing(account) VALUES(row_invoice.account) ON CONFLICT DO NOTHING;
 UPDATE portova_crypto_invoices SET status='paid',paid_at=paid_time,block_number=height WHERE id=invoice;
 RETURN jsonb_build_object('status','paid','startsAt',start_time,'endsAt',end_time,'plan',row_invoice.plan);
END $$;
