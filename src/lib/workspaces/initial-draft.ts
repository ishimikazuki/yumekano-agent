import type { DraftState } from '@/lib/schemas';
import type { CharacterAssets } from '@/lib/sources/character-asset-source';
import { workspaceRepo } from '@/lib/repositories';
import { createPublishedSource } from '@/lib/sources/published-source';

function toDraftState(assets: CharacterAssets): DraftState {
  return {
    identity: assets.identity,
    persona: assets.persona,
    style: assets.style,
    autonomy: assets.autonomy,
    emotion: assets.emotion,
    memory: assets.memory,
    phaseGraph: assets.phaseGraph,
    prompts: assets.prompts,
    baseVersionId: assets.sourceType === 'published' ? assets.sourceId : null,
  };
}

export async function resolveInitialDraftForCharacter(
  characterId: string,
  excludeWorkspaceId?: string
): Promise<DraftState | null> {
  const workspaces = await workspaceRepo.listByCharacter(characterId);

  for (const workspace of workspaces) {
    if (workspace.id === excludeWorkspaceId) {
      continue;
    }

    const draft = await workspaceRepo.getDraft(workspace.id);
    if (draft) {
      return draft;
    }
  }

  const publishedSource = await createPublishedSource(characterId, 'prod');
  if (!publishedSource) {
    return null;
  }

  const assets = await publishedSource.load();
  return toDraftState(assets);
}
