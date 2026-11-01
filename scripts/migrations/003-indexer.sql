CREATE OR REPLACE FUNCTION portova_ingest(g text, expected bigint, h bigint, bh text, parent text, items jsonb) RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE current_height bigint; current_hash text;
BEGIN
  SELECT height,hash INTO current_height,current_hash FROM portova_indexer WHERE genesis=g FOR UPDATE;
  IF current_height IS NULL THEN RAISE EXCEPTION 'indexer_not_initialized'; END IF;
  IF current_height <> expected THEN RETURN false; END IF;
  IF h <> current_height+1 OR current_hash <> parent THEN RAISE EXCEPTION 'indexer_parent_mismatch'; END IF;
  INSERT INTO portova_events(genesis,height,hash,tx_hash,tx_index,call,success,subjects)
  SELECT g,h,bh,x->>'txHash',(x->>'index')::integer,x->>'call',(x->>'success')::boolean,x->'subjects' FROM jsonb_array_elements(items) x ON CONFLICT DO NOTHING;
  UPDATE portova_indexer SET height=h,hash=bh,updated_at=now() WHERE genesis=g;
  RETURN true;
END $$;
CREATE OR REPLACE FUNCTION portova_monitor(pid text, rev integer, prior bigint, h bigint, bh text, facts_new jsonb, changes jsonb) RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE saved_revision integer; saved_height bigint;
BEGIN
  SELECT revision INTO saved_revision FROM portova_projects WHERE id=pid FOR UPDATE;
  IF saved_revision IS NULL OR saved_revision<>rev THEN RETURN false; END IF;
  SELECT block_number INTO saved_height FROM portova_snapshots WHERE project_id=pid;
  IF COALESCE(saved_height,-1)<>prior OR COALESCE(saved_height,-1)>=h THEN RETURN false; END IF;
  INSERT INTO portova_alerts(project_id,fingerprint,kind,message,block_number)
    SELECT pid,pid||':'||h||':'||(x->>'kind'),x->>'kind',x->>'message',h FROM jsonb_array_elements(changes) x ON CONFLICT DO NOTHING;
  INSERT INTO portova_snapshots(project_id,block_number,block_hash,facts) VALUES(pid,h,bh,facts_new)
    ON CONFLICT(project_id) DO UPDATE SET block_number=h,block_hash=bh,facts=facts_new,updated_at=now();
  INSERT INTO portova_jobs(name,cursor) VALUES('monitor',pid) ON CONFLICT(name) DO UPDATE SET cursor=pid,updated_at=now();
  RETURN true;
END $$;
