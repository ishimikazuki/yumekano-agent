UPDATE eval_runs
SET status = 'failed'
WHERE id IN (
  SELECT id
  FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY character_version_id
        ORDER BY created_at DESC, id DESC
      ) AS row_num
    FROM eval_runs
    WHERE status IN ('pending', 'running')
  ) ranked_active_runs
  WHERE row_num > 1
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_eval_runs_one_active_per_version
ON eval_runs(character_version_id)
WHERE status IN ('pending', 'running');
