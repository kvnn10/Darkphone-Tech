-- Add B-tree indexes for single-column foreign keys that lack a leading-column index.
-- This helps joins and deletes/updates on parent rows without changing application data.
DO $$
DECLARE
  fk record;
  index_name text;
BEGIN
  FOR fk IN
    SELECT c.conrelid AS table_oid,
           c.conrelid::regclass AS table_name,
           a.attname AS column_name,
           n.nspname AS schema_name,
           t.relname AS relation_name
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
    WHERE c.contype = 'f'
      AND cardinality(c.conkey) = 1
      AND n.nspname = 'public'
      AND NOT EXISTS (
        SELECT 1
        FROM pg_index i
        WHERE i.indrelid = c.conrelid
          AND i.indisvalid
          AND i.indpred IS NULL
          AND i.indkey[0] = c.conkey[1]
      )
  LOOP
    index_name := left('idx_fk_' || fk.relation_name || '_' || fk.column_name, 48)
                  || '_' || substr(md5(fk.relation_name || ':' || fk.column_name), 1, 8);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %s (%I)', index_name, fk.table_name, fk.column_name);
  END LOOP;
END $$;
