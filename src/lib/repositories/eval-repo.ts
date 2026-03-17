import { getDb } from '../db/client';
import { v4 as uuid } from 'uuid';
import {
  ScenarioSet,
  ScenarioSetSchema,
  ScenarioCase,
  ScenarioCaseSchema,
  ScenarioCaseInput,
  ScenarioCaseExpected,
  EvalRun,
  EvalRunSchema,
  EvalRunStatus,
  EvalCaseResult,
  EvalCaseResultSchema,
} from '../schemas';

/**
 * Repository for evaluation operations.
 */
export const evalRepo = {
  // ==========================================
  // Scenario Sets
  // ==========================================

  async createScenarioSet(input: {
    characterId: string;
    name: string;
    description: string;
    version?: number;
  }): Promise<ScenarioSet> {
    const db = getDb();
    const id = uuid();
    const now = new Date().toISOString();

    await db.execute({
      sql: `INSERT INTO scenario_sets (id, character_id, name, description, version, created_at)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: [id, input.characterId, input.name, input.description, input.version ?? 1, now],
    });

    return ScenarioSetSchema.parse({
      id,
      characterId: input.characterId,
      name: input.name,
      description: input.description,
      version: input.version ?? 1,
      createdAt: now,
    });
  },

  async getScenarioSetById(id: string): Promise<ScenarioSet | null> {
    const db = getDb();
    const result = await db.execute({
      sql: `SELECT * FROM scenario_sets WHERE id = ?`,
      args: [id],
    });

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return ScenarioSetSchema.parse({
      id: row.id,
      characterId: row.character_id,
      name: row.name,
      description: row.description,
      version: row.version,
      createdAt: row.created_at,
    });
  },

  async listScenarioSets(characterId: string): Promise<ScenarioSet[]> {
    const db = getDb();
    const result = await db.execute({
      sql: `SELECT * FROM scenario_sets WHERE character_id = ? ORDER BY created_at DESC`,
      args: [characterId],
    });

    return result.rows.map((row) =>
      ScenarioSetSchema.parse({
        id: row.id,
        characterId: row.character_id,
        name: row.name,
        description: row.description,
        version: row.version,
        createdAt: row.created_at,
      })
    );
  },

  // ==========================================
  // Scenario Cases
  // ==========================================

  async createScenarioCase(input: {
    scenarioSetId: string;
    title: string;
    input: ScenarioCaseInput;
    expected: ScenarioCaseExpected;
    tags?: string[];
  }): Promise<ScenarioCase> {
    const db = getDb();
    const id = uuid();
    const now = new Date().toISOString();

    await db.execute({
      sql: `INSERT INTO scenario_cases (id, scenario_set_id, title, input_json, expected_json, tags_json, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [
        id,
        input.scenarioSetId,
        input.title,
        JSON.stringify(input.input),
        JSON.stringify(input.expected),
        JSON.stringify(input.tags ?? []),
        now,
      ],
    });

    return ScenarioCaseSchema.parse({
      id,
      scenarioSetId: input.scenarioSetId,
      title: input.title,
      input: input.input,
      expected: input.expected,
      tags: input.tags ?? [],
      createdAt: now,
    });
  },

  async getScenarioCasesBySet(scenarioSetId: string): Promise<ScenarioCase[]> {
    const db = getDb();
    const result = await db.execute({
      sql: `SELECT * FROM scenario_cases WHERE scenario_set_id = ?`,
      args: [scenarioSetId],
    });

    return result.rows.map((row) =>
      ScenarioCaseSchema.parse({
        id: row.id,
        scenarioSetId: row.scenario_set_id,
        title: row.title,
        input: JSON.parse(row.input_json as string),
        expected: JSON.parse(row.expected_json as string),
        tags: JSON.parse(row.tags_json as string),
        createdAt: row.created_at,
      })
    );
  },

  // ==========================================
  // Eval Runs
  // ==========================================

  async createEvalRun(input: {
    scenarioSetId: string;
    characterVersionId: string;
    modelRegistrySnapshot: unknown;
  }): Promise<EvalRun> {
    const db = getDb();
    const id = uuid();
    const now = new Date().toISOString();

    await db.execute({
      sql: `INSERT INTO eval_runs (id, scenario_set_id, character_version_id, model_registry_snapshot_json, status, created_at)
            VALUES (?, ?, ?, ?, 'pending', ?)`,
      args: [id, input.scenarioSetId, input.characterVersionId, JSON.stringify(input.modelRegistrySnapshot), now],
    });

    return EvalRunSchema.parse({
      id,
      scenarioSetId: input.scenarioSetId,
      characterVersionId: input.characterVersionId,
      modelRegistrySnapshot: input.modelRegistrySnapshot,
      status: 'pending' as EvalRunStatus,
      summary: null,
      createdAt: now,
    });
  },

  async updateEvalRunStatus(
    id: string,
    status: EvalRunStatus,
    summary?: {
      totalCases: number;
      passedCases: number;
      failedCases: number;
      averageScores: Record<string, number>;
    }
  ): Promise<void> {
    const db = getDb();
    await db.execute({
      sql: `UPDATE eval_runs SET status = ?, summary_json = ? WHERE id = ?`,
      args: [status, summary ? JSON.stringify(summary) : null, id],
    });
  },

  async getEvalRunById(id: string): Promise<EvalRun | null> {
    const db = getDb();
    const result = await db.execute({
      sql: `SELECT * FROM eval_runs WHERE id = ?`,
      args: [id],
    });

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return EvalRunSchema.parse({
      id: row.id,
      scenarioSetId: row.scenario_set_id,
      characterVersionId: row.character_version_id,
      modelRegistrySnapshot: JSON.parse(row.model_registry_snapshot_json as string),
      status: row.status,
      summary: row.summary_json ? JSON.parse(row.summary_json as string) : null,
      createdAt: row.created_at,
    });
  },

  async listEvalRuns(characterVersionId: string): Promise<EvalRun[]> {
    const db = getDb();
    const result = await db.execute({
      sql: `SELECT * FROM eval_runs WHERE character_version_id = ? ORDER BY created_at DESC`,
      args: [characterVersionId],
    });

    return result.rows.map((row) =>
      EvalRunSchema.parse({
        id: row.id,
        scenarioSetId: row.scenario_set_id,
        characterVersionId: row.character_version_id,
        modelRegistrySnapshot: JSON.parse(row.model_registry_snapshot_json as string),
        status: row.status,
        summary: row.summary_json ? JSON.parse(row.summary_json as string) : null,
        createdAt: row.created_at,
      })
    );
  },

  // ==========================================
  // Eval Case Results
  // ==========================================

  async createCaseResult(input: {
    evalRunId: string;
    scenarioCaseId: string;
    scores: Record<string, number>;
    passed: boolean;
    failureReasons: string[];
    traceId: string;
  }): Promise<EvalCaseResult> {
    const db = getDb();
    const id = uuid();
    const now = new Date().toISOString();

    await db.execute({
      sql: `INSERT INTO eval_case_results (id, eval_run_id, scenario_case_id, scores_json, passed, failure_reasons_json, trace_id, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        id,
        input.evalRunId,
        input.scenarioCaseId,
        JSON.stringify(input.scores),
        input.passed ? 1 : 0,
        JSON.stringify(input.failureReasons),
        input.traceId,
        now,
      ],
    });

    return EvalCaseResultSchema.parse({
      id,
      evalRunId: input.evalRunId,
      scenarioCaseId: input.scenarioCaseId,
      scores: input.scores,
      passed: input.passed,
      failureReasons: input.failureReasons,
      traceId: input.traceId,
      createdAt: now,
    });
  },

  async getCaseResultsByRun(evalRunId: string): Promise<EvalCaseResult[]> {
    const db = getDb();
    const result = await db.execute({
      sql: `SELECT * FROM eval_case_results WHERE eval_run_id = ?`,
      args: [evalRunId],
    });

    return result.rows.map((row) =>
      EvalCaseResultSchema.parse({
        id: row.id,
        evalRunId: row.eval_run_id,
        scenarioCaseId: row.scenario_case_id,
        scores: JSON.parse(row.scores_json as string),
        passed: row.passed === 1,
        failureReasons: JSON.parse(row.failure_reasons_json as string),
        traceId: row.trace_id,
        createdAt: row.created_at,
      })
    );
  },
};
