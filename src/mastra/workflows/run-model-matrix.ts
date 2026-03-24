import { getProviderRegistry } from '../providers/registry';
import type { ModelRoleConfig } from '../providers/model-roles';
import { runEvalSuite, type RunEvalSuiteOutput } from './run-eval-suite';

export type ModelMatrixVariant = {
  name: string;
  roles: Partial<ModelRoleConfig>;
};

export type RunModelMatrixInput = {
  characterVersionId: string;
  scenarioSetId: string;
  variants: ModelMatrixVariant[];
};

export type RunModelMatrixOutput = {
  baseline: ModelRoleConfig;
  variants: Array<{
    name: string;
    roles: Partial<ModelRoleConfig>;
    summary: RunEvalSuiteOutput['summary'];
    evalRunId: string;
  }>;
};

export async function runModelMatrix(
  input: RunModelMatrixInput
): Promise<RunModelMatrixOutput> {
  const registry = getProviderRegistry();
  const baseline = registry.snapshot();
  const results: RunModelMatrixOutput['variants'] = [];

  try {
    for (const variant of input.variants) {
      applyRoleOverrides(registry, baseline, variant.roles);
      const evalResult = await runEvalSuite({
        characterVersionId: input.characterVersionId,
        scenarioSetId: input.scenarioSetId,
      });

      results.push({
        name: variant.name,
        roles: variant.roles,
        summary: evalResult.summary,
        evalRunId: evalResult.evalRunId,
      });
    }
  } finally {
    applyRoleOverrides(registry, baseline, baseline);
  }

  return {
    baseline,
    variants: results,
  };
}

function applyRoleOverrides(
  registry: ReturnType<typeof getProviderRegistry>,
  baseline: ModelRoleConfig,
  roles: Partial<ModelRoleConfig>
) {
  (Object.keys(baseline) as Array<keyof ModelRoleConfig>).forEach((role) => {
    const next = roles[role] ?? baseline[role];
    registry.setModel(role, next.provider, next.modelId);
  });
}
