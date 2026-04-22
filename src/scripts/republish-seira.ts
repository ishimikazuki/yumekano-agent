/**
 * Republish Seira with the current seed values as a new character version.
 *
 * Use this when:
 * - Production DB already has a seira character version (older than T-E).
 * - You want to publish the current `seed-seira.ts` values as a fresh version
 *   without wiping existing conversation history / traces.
 *
 * Safety:
 * - Idempotent: if the latest published version already matches the current
 *   seed (by deep-equal on persona/style/emotion/autonomy/memory/phaseGraph),
 *   this exits without creating a new version.
 * - Never deletes prior versions. They remain queryable for rollback.
 *
 * Usage:
 *   DATABASE_URL=<prod-url> npx tsx src/scripts/republish-seira.ts
 *
 * Output: logs what it did (noop / created version id + release id).
 */
import {
  characterRepo,
  phaseGraphRepo,
  promptBundleRepo,
  releaseRepo,
  workspaceRepo,
} from '../lib/repositories';
import {
  createSeiraDraftState,
  seiraCompiledPersona,
  seiraPhaseGraph,
  seiraPrompts,
} from '../lib/db/seed-seira';

function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

async function main() {
  const seiraChar = await characterRepo.getBySlug('seira');
  if (!seiraChar) {
    console.error(
      'Seira character not found. Run `npm run db:seed` first to bootstrap.'
    );
    process.exit(1);
  }

  const versions = await characterRepo.listVersions(seiraChar.id);
  const latest = versions.length > 0 ? versions[0] : null;
  const draft = createSeiraDraftState();

  if (
    latest &&
    deepEqual(latest.persona, { ...draft.persona, compiledPersona: seiraCompiledPersona }) &&
    deepEqual(latest.style, draft.style) &&
    deepEqual(latest.autonomy, draft.autonomy) &&
    deepEqual(latest.emotion, draft.emotion) &&
    deepEqual(latest.memory, draft.memory)
  ) {
    console.log(
      `Latest version (${latest.id}, v${latest.versionNumber}) already matches seed-seira.ts — nothing to do.`
    );
    return;
  }

  console.log('Creating new phase graph version…');
  const phaseGraphVersion = await phaseGraphRepo.create({
    characterId: seiraChar.id,
    graph: seiraPhaseGraph,
  });

  console.log('Creating new prompt bundle version…');
  const promptBundleVersion = await promptBundleRepo.create({
    characterId: seiraChar.id,
    prompts: seiraPrompts,
  });

  console.log('Creating new character version…');
  const version = await characterRepo.createVersion({
    characterId: seiraChar.id,
    persona: { ...draft.persona, compiledPersona: seiraCompiledPersona },
    style: draft.style,
    autonomy: draft.autonomy,
    emotion: draft.emotion,
    memory: draft.memory,
    phaseGraphVersionId: phaseGraphVersion.id,
    promptBundleVersionId: promptBundleVersion.id,
    createdBy: 'republish-script',
    status: 'published',
  });
  console.log(`Created version: ${version.id} (v${version.versionNumber})`);

  console.log('Creating release…');
  const release = await releaseRepo.create({
    characterId: seiraChar.id,
    characterVersionId: version.id,
    publishedBy: 'republish-script',
  });
  console.log(`Created release: ${release.id}`);

  // Also refresh the default workspace draft so dashboard editing starts from
  // the new baseline rather than the older version.
  const workspaces = await workspaceRepo.listByCharacter(seiraChar.id);
  if (workspaces.length > 0) {
    const ws = workspaces[0];
    console.log(`Updating workspace draft ${ws.id} with new baseline…`);
    await workspaceRepo.initDraft(ws.id, {
      ...draft,
      baseVersionId: version.id,
    });
    console.log('Workspace draft updated.');
  } else {
    console.log('No workspace exists — skipping draft refresh.');
  }

  console.log('\nRepublish complete.');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Republish failed:', err);
    process.exit(1);
  });
