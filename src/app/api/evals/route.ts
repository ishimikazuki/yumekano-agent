import { NextRequest, NextResponse } from 'next/server';
import { characterRepo, evalRepo, releaseRepo } from '@/lib/repositories';
import { runEvalSuite } from '@/mastra/workflows/run-eval-suite';
import { ensureScenarioSetInDb, listLocalScenarioSets } from '@/lib/evals/local-scenario-sets';
import { z } from 'zod';

const RunEvalRequestSchema = z.object({
  characterId: z.string().uuid(),
  scenarioSetKey: z.string().min(1),
});

function formatEvalRun(run: Awaited<ReturnType<typeof evalRepo.getEvalRunById>> extends infer T ? T : never) {
  if (!run) {
    return null;
  }

  return {
    id: run.id,
    scenarioSetId: run.scenarioSetId,
    characterVersionId: run.characterVersionId,
    status: run.status,
    summary: run.summary
      ? {
          totalCases: run.summary.totalCases,
          passed: run.summary.passedCases,
          failed: run.summary.failedCases,
          avgScore: run.summary.averageScores.overall ?? 0,
        }
      : null,
    createdAt: run.createdAt,
  };
}

function formatCaseResult(result: Awaited<ReturnType<typeof evalRepo.getCaseResultsByRun>>[number]) {
  return {
    id: result.id,
    scenarioCaseId: result.scenarioCaseId,
    passed: result.passed,
    traceId: result.traceId,
    failureReasons: result.failureReasons,
    scores: result.scores,
    createdAt: result.createdAt,
  };
}

function isUniqueConstraintError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;

  const code = 'code' in error ? (error as { code?: unknown }).code : undefined;
  const message = error instanceof Error ? error.message : String(error);

  return (
    code === '23505' ||
    code === 'SQLITE_CONSTRAINT' ||
    code === 'SQLITE_CONSTRAINT_UNIQUE' ||
    message.toLowerCase().includes('unique constraint') ||
    message.toLowerCase().includes('duplicate key')
  );
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const characterId = searchParams.get('characterId');

    if (!characterId) {
      return NextResponse.json(
        { error: 'characterId is required' },
        { status: 400 }
      );
    }

    const currentRelease = await releaseRepo.getCurrent(characterId, 'prod');
    const currentVersion = currentRelease
      ? await characterRepo.getVersionById(currentRelease.characterVersionId)
      : await characterRepo.getLatestPublished(characterId);

    const [scenarioSets, evalRuns] = await Promise.all([
      listLocalScenarioSets(),
      currentVersion ? evalRepo.listEvalRuns(currentVersion.id) : Promise.resolve([]),
    ]);
    const latestCompletedRun = evalRuns.find((run) => run.status === 'completed') ?? null;
    const latestCaseResults = latestCompletedRun
      ? await evalRepo.getCaseResultsByRun(latestCompletedRun.id)
      : [];

    return NextResponse.json({
      currentVersion: currentVersion
        ? {
            id: currentVersion.id,
            versionNumber: currentVersion.versionNumber,
            label: currentVersion.label ?? null,
            status: currentVersion.status,
          }
        : null,
      scenarioSets: scenarioSets.map((scenarioSet) => ({
        key: scenarioSet.key,
        name: scenarioSet.name,
        description: scenarioSet.description,
        caseCount: scenarioSet.caseCount,
      })),
      evalRuns: evalRuns.map((run) => ({
        id: run.id,
        scenarioSetId: run.scenarioSetId,
        characterVersionId: run.characterVersionId,
        status: run.status,
        summary: run.summary
          ? {
              totalCases: run.summary.totalCases,
              passed: run.summary.passedCases,
              failed: run.summary.failedCases,
              avgScore: run.summary.averageScores.overall ?? 0,
            }
          : null,
        createdAt: run.createdAt,
        })),
      latestCaseResults: latestCaseResults.map(formatCaseResult),
    });
  } catch (error) {
    console.error('Get eval data error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = RunEvalRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { characterId, scenarioSetKey } = parsed.data;
    const currentRelease = await releaseRepo.getCurrent(characterId, 'prod');
    const currentVersion = currentRelease
      ? await characterRepo.getVersionById(currentRelease.characterVersionId)
      : await characterRepo.getLatestPublished(characterId);

    if (!currentVersion) {
      return NextResponse.json(
        { error: 'No published/live version available for eval' },
        { status: 409 }
      );
    }

    const existingRun = await evalRepo.getActiveRun(currentVersion.id);

    if (existingRun) {
      return NextResponse.json(
        {
          error: 'An eval run is already in progress',
          evalRun: formatEvalRun(existingRun),
        },
        { status: 409 }
      );
    }

    const scenarioSet = await ensureScenarioSetInDb(characterId, scenarioSetKey);
    let evalRun;
    try {
      evalRun = await evalRepo.createRun({
        characterVersionId: currentVersion.id,
        scenarioSetId: scenarioSet.id,
        modelRegistrySnapshot: {},
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        const activeRun = await evalRepo.getActiveRun(currentVersion.id);
        if (activeRun) {
          return NextResponse.json(
            {
              error: 'An eval run is already in progress',
              evalRun: formatEvalRun(activeRun),
            },
            { status: 409 }
          );
        }
      }

      throw error;
    }

    void runEvalSuite({
      evalRunId: evalRun.id,
      characterVersionId: currentVersion.id,
      scenarioSetId: scenarioSet.id,
    }).catch((error) => {
      console.error('Background eval run failed:', error);
    });

    return NextResponse.json({
      evalRun: formatEvalRun(evalRun),
      scenarioSet: {
        id: scenarioSet.id,
        key: scenarioSetKey,
        name: scenarioSet.name,
      },
    }, { status: 202 });
  } catch (error) {
    console.error('Run eval error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
