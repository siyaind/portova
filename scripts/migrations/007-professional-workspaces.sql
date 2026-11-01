-- Explicit, one-time pilot access. Paid terms keep priority; trials never renew themselves.
CREATE TABLE portova_pilots (
 account varchar(64) PRIMARY KEY, starts_at timestamptz NOT NULL DEFAULT now(),
 ends_at timestamptz NOT NULL DEFAULT now()+interval '30 days', CHECK(ends_at>starts_at)
);
CREATE OR REPLACE VIEW portova_entitlements AS
SELECT a.account,b.customer_id,b.subscription_id,b.checkout_request,b.checkout_expires,
 CASE WHEN t.plan IS NOT NULL THEN t.plan WHEN NOT EXISTS(SELECT 1 FROM portova_crypto_terms x WHERE x.account=a.account) AND b.status='active' AND b.period_end>now() THEN b.plan WHEN p.ends_at>now() THEN 'team' ELSE 'free' END AS plan,
 CASE WHEN t.plan IS NOT NULL OR (NOT EXISTS(SELECT 1 FROM portova_crypto_terms x WHERE x.account=a.account) AND b.status='active' AND b.period_end>now()) OR p.ends_at>now() THEN 'active' ELSE 'inactive' END AS status,
 CASE WHEN t.plan IS NOT NULL THEN t.ends_at WHEN NOT EXISTS(SELECT 1 FROM portova_crypto_terms x WHERE x.account=a.account) AND b.status='active' AND b.period_end>now() THEN b.period_end ELSE p.ends_at END AS period_end,
 b.last_event_created,b.updated_at,
 CASE WHEN t.plan IS NOT NULL THEN 'crypto' WHEN NOT EXISTS(SELECT 1 FROM portova_crypto_terms x WHERE x.account=a.account) AND b.status='active' AND b.period_end>now() THEN 'legacy' WHEN p.ends_at>now() THEN 'pilot' ELSE 'free' END AS source
FROM (SELECT account FROM portova_billing UNION SELECT account FROM portova_pilots) a
LEFT JOIN portova_billing b ON b.account=a.account LEFT JOIN portova_pilots p ON p.account=a.account
LEFT JOIN LATERAL(SELECT plan,ends_at FROM portova_crypto_terms WHERE account=a.account AND starts_at<=now() AND ends_at>now() ORDER BY starts_at DESC LIMIT 1) t ON true;

ALTER TABLE portova_projects ADD COLUMN directory_status text NOT NULL DEFAULT 'unreviewed' CHECK(directory_status IN ('unreviewed','pending','reviewed','hidden'));
ALTER TABLE portova_projects ADD COLUMN review_revision integer;
ALTER TABLE portova_projects ADD COLUMN review_note text;
ALTER TABLE portova_projects ADD COLUMN reviewed_at timestamptz;
CREATE INDEX portova_directory_public ON portova_projects(id) WHERE published AND directory_status<>'hidden';
CREATE TABLE portova_project_evidence (
 project_id text PRIMARY KEY REFERENCES portova_projects(id) ON DELETE CASCADE,
 revision integer NOT NULL,genesis text NOT NULL,block_number bigint NOT NULL,
 checked_at timestamptz NOT NULL DEFAULT now(),facts jsonb NOT NULL
);

-- Publication changes invalidate review; hidden entries require an operator decision.
CREATE FUNCTION portova_directory_revision() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF NEW.revision<>OLD.revision AND OLD.directory_status<>'hidden' THEN
   NEW.directory_status:='unreviewed';NEW.review_revision:=NULL;NEW.review_note:=NULL;NEW.reviewed_at:=NULL;
 END IF; RETURN NEW;
END $$;
CREATE TRIGGER portova_directory_revision BEFORE UPDATE ON portova_projects FOR EACH ROW EXECUTE FUNCTION portova_directory_revision();

-- Switch permission and quota reads to time-based prepaid entitlements.
CREATE OR REPLACE FUNCTION portova_execute(request_id uuid) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE c portova_challenges%ROWTYPE; p portova_projects%ROWTYPE; b portova_entitlements%ROWTYPE;
  cmd jsonb; output jsonb; op text; pid text; actor text; permission text; tier text := 'free';
  project_limit integer := 3; payload_project jsonb; subject text; count_rows integer;
BEGIN
  SELECT * INTO c FROM portova_challenges WHERE id=request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'request_expired'; END IF;
  IF c.result IS NOT NULL AND c.consumed_at > now()-interval '24 hours' THEN RETURN c.result; END IF;
  IF c.expires_at <= now() THEN RAISE EXCEPTION 'request_expired'; END IF;
  cmd := c.payload; actor := c.owner; op := cmd->>'action'; pid := cmd->>'projectId';
  -- Serialize mutations belonging to an account (including first-save quota checks).
  PERFORM pg_advisory_xact_lock(hashtext(actor));
  SELECT * INTO b FROM portova_entitlements WHERE account=actor;
  IF b.status='active' AND b.period_end > now() THEN tier := b.plan; END IF;
  project_limit := CASE WHEN b.source='pilot' THEN 5 WHEN tier='team' THEN 100 WHEN tier='pro' THEN 20 ELSE 3 END;
  IF op='pilot' THEN
    INSERT INTO portova_pilots(account) VALUES(actor) ON CONFLICT DO NOTHING;
    SELECT jsonb_build_object('message',CASE WHEN ends_at>now() THEN 'Your free pilot is active. Load workspaces to see access and expiry.' ELSE 'This wallet has already used its pilot. Existing projects remain accessible.' END,'pilot',jsonb_build_object('endsAt',ends_at,'active',ends_at>now(),'projects',5,'collaborators',3)) INTO output FROM portova_pilots WHERE account=actor;
  ELSIF op='list' THEN
    SELECT jsonb_build_object('projects',COALESCE(jsonb_agg(row_to_json(x)::jsonb),'[]'::jsonb),
      'plan',tier,'access',jsonb_build_object('source',COALESCE(b.source,'free'),'endsAt',b.period_end,'projects',project_limit,'collaborators',CASE WHEN b.source='pilot' THEN 3 WHEN tier='team' THEN 10 ELSE 0 END),'tickets',COALESCE((SELECT jsonb_agg(t) FROM (SELECT id,category,status,response FROM portova_support WHERE account=actor ORDER BY created_at DESC LIMIT 20) t),'[]'::jsonb),'invitations',COALESCE((SELECT jsonb_agg(jsonb_build_object('projectId',m.project_id,'name',q.project->>'name','role',m.role)) FROM portova_members m JOIN portova_projects q ON q.id=m.project_id WHERE m.account=actor AND NOT m.accepted AND m.expires_at>now()),'[]'::jsonb),
      'transfers',COALESCE((SELECT jsonb_agg(jsonb_build_object('projectId',t.project_id,'name',q.project->>'name')) FROM portova_transfers t JOIN portova_projects q ON q.id=t.project_id WHERE t.to_owner=actor AND t.expires_at>now()),'[]'::jsonb)) INTO output
      FROM (SELECT q.*,CASE WHEN q.owner=actor THEN 'owner' ELSE m.role END AS role FROM portova_projects q LEFT JOIN portova_members m ON m.project_id=q.id AND m.account=actor AND m.accepted WHERE q.owner=actor OR m.account=actor ORDER BY q.updated_at DESC LIMIT 100) x;
  ELSIF op='support' THEN
    INSERT INTO portova_support(id,account,category,message) VALUES(c.id,actor,cmd->>'category',cmd->>'message');
    output := jsonb_build_object('ticket',c.id,'message','Request saved. Track it in your workspace; response times are not guaranteed during the pilot.');
  ELSIF op IN ('checkout','billing') THEN
    output := jsonb_build_object('account',actor,'plan',tier,'billing',CASE WHEN b.account IS NULL THEN NULL ELSE jsonb_build_object('status',b.status,'periodEnd',b.period_end) END);
  ELSE
    IF op='save' THEN pid := cmd->'project'->>'id'; END IF;
    SELECT * INTO p FROM portova_projects WHERE id=pid FOR UPDATE;
    permission := NULL;
    IF p.owner=actor THEN permission := 'owner'; ELSE
      SELECT role INTO permission FROM portova_members WHERE project_id=pid AND account=actor AND accepted;
      IF permission='editor' AND NOT EXISTS(SELECT 1 FROM portova_entitlements WHERE account=p.owner AND plan='team' AND status='active' AND period_end>now()) THEN permission := 'viewer'; END IF;
    END IF;
    IF op='save' THEN
      payload_project := cmd->'project';
      IF p.id IS NULL THEN
        IF (cmd->>'revision')::integer <> 0 THEN RAISE EXCEPTION 'revision_conflict'; END IF;
        SELECT count(*) INTO count_rows FROM portova_projects WHERE owner=actor;
        IF count_rows >= project_limit THEN RAISE EXCEPTION 'plan_limit'; END IF;
        INSERT INTO portova_projects(id,owner,revision,project,description,published) VALUES(pid,actor,1,payload_project,cmd->>'description',(cmd->>'published')::boolean) RETURNING * INTO p;
      ELSE
        IF permission IS NULL OR permission='viewer' THEN RAISE EXCEPTION 'permission_denied'; END IF;
        IF permission <> 'owner' AND (cmd->>'published')::boolean <> p.published THEN RAISE EXCEPTION 'permission_denied'; END IF;
        IF p.revision <> (cmd->>'revision')::integer THEN RAISE EXCEPTION 'revision_conflict'; END IF;
        UPDATE portova_projects SET revision=revision+1,project=payload_project,description=cmd->>'description',published=(cmd->>'published')::boolean,updated_at=now() WHERE id=pid RETURNING * INTO p;
      END IF;
      output := jsonb_build_object('project',to_jsonb(p));
    ELSIF op='verify' OR op='submit-review' THEN
      IF permission IS DISTINCT FROM 'owner' THEN RAISE EXCEPTION 'permission_denied'; END IF;
      IF op='submit-review' THEN
        IF NOT p.published OR length(trim(p.description))<30 OR COALESCE(p.project->>'assetId','')||COALESCE(p.project->>'collectionId','')||COALESCE(p.project->>'poolLpToken','')='' THEN RAISE EXCEPTION 'directory_incomplete'; END IF;
        IF p.directory_status='hidden' THEN RAISE EXCEPTION 'permission_denied'; END IF;
        UPDATE portova_projects SET directory_status='pending',review_revision=p.revision WHERE id=pid;
      END IF;
      output:=jsonb_build_object('message',CASE WHEN op='verify' THEN 'Checking the publisher wallet against finalized chain roles.' ELSE 'Review requested. Your page remains labelled community-published until an operator reviews this revision.' END);
    ELSIF op='accept' THEN
      IF NOT EXISTS(SELECT 1 FROM portova_entitlements WHERE account=p.owner AND plan='team' AND status='active' AND period_end>now()) THEN RAISE EXCEPTION 'team_required'; END IF;
      IF NOT EXISTS(SELECT 1 FROM portova_members WHERE project_id=pid AND account=actor AND NOT accepted AND expires_at>now()) THEN RAISE EXCEPTION 'permission_denied'; END IF;
      UPDATE portova_members SET accepted=true WHERE project_id=pid AND account=actor;
      output := jsonb_build_object('message','Invitation accepted. Load cloud projects to open the workspace.');
    ELSIF op='accept-transfer' THEN
      IF NOT EXISTS(SELECT 1 FROM portova_transfers WHERE project_id=pid AND to_owner=actor AND from_owner=p.owner AND expires_at>now()) THEN RAISE EXCEPTION 'permission_denied'; END IF;
      IF (SELECT count(*) FROM portova_projects WHERE owner=actor) >= project_limit THEN RAISE EXCEPTION 'plan_limit'; END IF;
      UPDATE portova_projects SET owner=actor,revision=revision+1,updated_at=now() WHERE id=pid;
      DELETE FROM portova_members WHERE project_id=pid;
      DELETE FROM portova_transfers WHERE project_id=pid;
      output := jsonb_build_object('message','Workspace ownership transferred. Collaborators were cleared. Chain ownership is unchanged.');
    ELSIF op='dashboard' THEN
      IF permission IS NULL THEN RAISE EXCEPTION 'permission_denied'; END IF;
      SELECT jsonb_build_object('role',permission,'capabilities',jsonb_build_object('history',EXISTS(SELECT 1 FROM portova_entitlements WHERE account=p.owner AND status='active' AND period_end>now() AND plan IN ('pro','team'))),'audit',COALESCE((SELECT jsonb_agg(x) FROM (SELECT a.id,a.actor,a.action,a.detail,a.created_at FROM portova_audit a WHERE a.project_id=pid AND a.id<COALESCE((cmd->>'before')::bigint,9223372036854775807) ORDER BY a.id DESC LIMIT 50) x),'[]'::jsonb),
        'members',COALESCE((SELECT jsonb_agg(jsonb_build_object('account',account,'role',role,'accepted',accepted,'expiresAt',expires_at)) FROM portova_members WHERE project_id=pid),'[]'::jsonb),
        'snapshot',(SELECT to_jsonb(s) FROM portova_snapshots s WHERE s.project_id=pid),
        'alerts',COALESCE((SELECT jsonb_agg(x) FROM (SELECT kind,message,block_number,created_at FROM portova_alerts WHERE project_id=pid ORDER BY id DESC LIMIT 50) x),'[]'::jsonb),
        'indexer',(SELECT to_jsonb(i) FROM portova_indexer i LIMIT 1),
        'events',CASE WHEN EXISTS(SELECT 1 FROM portova_entitlements WHERE account=p.owner AND status='active' AND period_end>now() AND plan IN ('pro','team')) THEN COALESCE((SELECT jsonb_agg(x) FROM (SELECT height,hash,tx_hash,tx_index,call,success FROM portova_events WHERE subjects ?| ARRAY['asset:'||(p.project->>'assetId'),'collection:'||(p.project->>'collectionId'),'lp:'||(p.project->>'poolLpToken')] ORDER BY height DESC,tx_index DESC LIMIT 100) x),'[]'::jsonb) ELSE '[]'::jsonb END) INTO output;
    ELSE
      IF permission <> 'owner' OR permission IS NULL THEN RAISE EXCEPTION 'permission_denied'; END IF;
      subject := cmd->>'account';
      IF op='invite' THEN
        IF NOT EXISTS(SELECT 1 FROM portova_entitlements WHERE account=actor AND plan='team' AND status='active' AND period_end>now()) THEN RAISE EXCEPTION 'team_required'; END IF;
        IF subject=actor THEN RAISE EXCEPTION 'permission_denied'; END IF;
        IF (SELECT count(*) FROM portova_members WHERE project_id=pid) >= (CASE WHEN b.source='pilot' THEN 3 ELSE 10 END) AND NOT EXISTS(SELECT 1 FROM portova_members WHERE project_id=pid AND account=subject) THEN RAISE EXCEPTION 'plan_limit'; END IF;
        INSERT INTO portova_members(project_id,account,role) VALUES(pid,subject,cmd->>'role') ON CONFLICT(project_id,account) DO UPDATE SET role=EXCLUDED.role,accepted=false,expires_at=now()+interval '7 days';
      ELSIF op='revoke' THEN DELETE FROM portova_members WHERE project_id=pid AND account=subject;
      ELSIF op='transfer' THEN
        IF subject=actor THEN RAISE EXCEPTION 'permission_denied'; END IF;
        INSERT INTO portova_transfers VALUES(pid,actor,subject,now()+interval '1 day') ON CONFLICT(project_id) DO UPDATE SET from_owner=actor,to_owner=subject,expires_at=now()+interval '1 day';
      ELSIF op='delete' THEN DELETE FROM portova_projects WHERE id=pid;
      ELSE RAISE EXCEPTION 'invalid_operation'; END IF;
      output := jsonb_build_object('message',CASE WHEN op='delete' THEN 'Cloud project deleted. Chain objects remain on chain.' WHEN op='transfer' THEN 'Transfer offered for 24 hours. The recipient must sign acceptance.' ELSE 'Workspace updated.' END);
    END IF;
    IF op NOT IN ('dashboard') THEN INSERT INTO portova_audit(project_id,actor,action,detail) VALUES(pid,actor,op,jsonb_build_object('revision',p.revision,'account',subject)); END IF;
  END IF;
  UPDATE portova_challenges SET result=output,consumed_at=now() WHERE id=request_id;
  RETURN output;
END $$;
