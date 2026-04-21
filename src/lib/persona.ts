import { generateObject } from 'ai';
import { getProviderRegistry } from '@/mastra/providers/registry';
import {
  AnchorSchema,
  CompiledPersonaSchema,
  InnerWorldSchema,
  PersonaAuthoringSchema,
  ReactionPackSchema,
  RuntimePersonaSchema,
  SurfaceLoopSchema,
  TopicPackSchema,
  type CompiledPersona,
  type InnerWorld,
  type LegacyPersonaAuthoring,
  type PersonaAuthoring,
  type RuntimePersona,
} from '@/lib/schemas';

const AUTHORED_EXAMPLE_KEYS = ['warm', 'playful', 'guarded', 'conflict'] as const;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function normalizeOptionalText(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeRequiredText(value: unknown): string {
  return normalizeOptionalText(value) ?? '';
}

function dedupeStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed) {
      continue;
    }

    if (seen.has(trimmed)) {
      continue;
    }

    seen.add(trimmed);
    result.push(trimmed);
  }

  return result;
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return dedupeStrings(
    value
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
  );
}

function normalizeAuthoredExamples(value: unknown): PersonaAuthoring['authoredExamples'] {
  const record = asRecord(value) ?? {};
  const normalized = Object.fromEntries(
    AUTHORED_EXAMPLE_KEYS.map((key) => {
      const items = normalizeStringArray(record[key]);
      return [key, items.length > 0 ? items : undefined];
    })
  );

  return PersonaAuthoringSchema.shape.authoredExamples.parse(normalized);
}

function normalizeLegacyAuthoring(
  bucketValue: unknown,
  legacyRoot: Record<string, unknown>
): LegacyPersonaAuthoring | undefined {
  const bucket = asRecord(bucketValue) ?? {};
  const normalized: LegacyPersonaAuthoring = {};

  const innerWorldResult = InnerWorldSchema.safeParse(
    bucket.innerWorld ?? legacyRoot.innerWorld
  );
  if (innerWorldResult.success) {
    normalized.innerWorld = innerWorldResult.data;
  }

  const surfaceLoopResult = SurfaceLoopSchema.safeParse(
    bucket.surfaceLoop ?? legacyRoot.surfaceLoop
  );
  if (surfaceLoopResult.success) {
    normalized.surfaceLoop = surfaceLoopResult.data;
  }

  const anchorsResult = AnchorSchema.array().safeParse(
    bucket.anchors ?? legacyRoot.anchors
  );
  if (anchorsResult.success && anchorsResult.data.length > 0) {
    normalized.anchors = anchorsResult.data;
  }

  const topicPacksResult = TopicPackSchema.array().safeParse(
    bucket.topicPacks ?? legacyRoot.topicPacks
  );
  if (topicPacksResult.success && topicPacksResult.data.length > 0) {
    normalized.topicPacks = topicPacksResult.data;
  }

  const reactionPacksResult = ReactionPackSchema.array().safeParse(
    bucket.reactionPacks ?? legacyRoot.reactionPacks
  );
  if (reactionPacksResult.success && reactionPacksResult.data.length > 0) {
    normalized.reactionPacks = reactionPacksResult.data;
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

export function legacyInnerWorldToNoteMd(innerWorld?: InnerWorld): string | undefined {
  if (!innerWorld) {
    return undefined;
  }

  const lines = [
    innerWorld.coreDesire ? `望み: ${innerWorld.coreDesire}` : null,
    innerWorld.fear ? `恐れ: ${innerWorld.fear}` : null,
    innerWorld.wound ? `傷つきポイント: ${innerWorld.wound}` : null,
    innerWorld.coping ? `身を守る癖: ${innerWorld.coping}` : null,
    innerWorld.growthArc ? `変化の方向: ${innerWorld.growthArc}` : null,
  ].filter((line): line is string => Boolean(line));

  return lines.length > 0 ? lines.join('\n') : undefined;
}

export function normalizePersonaAuthoring(input: unknown): PersonaAuthoring {
  const record = asRecord(input) ?? {};
  const legacyAuthoring = normalizeLegacyAuthoring(record.legacyAuthoring, record);

  const normalized = {
    summary: normalizeRequiredText(record.summary),
    innerWorldNoteMd:
      normalizeOptionalText(record.innerWorldNoteMd) ??
      legacyInnerWorldToNoteMd(legacyAuthoring?.innerWorld),
    values: normalizeStringArray(record.values),
    vulnerabilities: dedupeStrings([
      ...normalizeStringArray(record.vulnerabilities),
      ...normalizeStringArray(record.flaws),
      ...normalizeStringArray(record.insecurities),
    ]),
    likes: normalizeStringArray(record.likes),
    dislikes: normalizeStringArray(record.dislikes),
    signatureBehaviors: normalizeStringArray(record.signatureBehaviors),
    authoredExamples: normalizeAuthoredExamples(record.authoredExamples),
    ...(legacyAuthoring ? { legacyAuthoring } : {}),
  };

  return PersonaAuthoringSchema.parse(normalized);
}

export function normalizeRuntimePersona(input: unknown): RuntimePersona {
  const record = asRecord(input) ?? {};
  const compiledResult = CompiledPersonaSchema.safeParse(record.compiledPersona);

  return RuntimePersonaSchema.parse({
    ...normalizePersonaAuthoring(record),
    ...(compiledResult.success ? { compiledPersona: compiledResult.data } : {}),
  });
}

export function toPersonaAuthoring(input: unknown): PersonaAuthoring {
  const normalized = normalizeRuntimePersona(input);
  return PersonaAuthoringSchema.parse({
    summary: normalized.summary,
    innerWorldNoteMd: normalized.innerWorldNoteMd,
    values: normalized.values,
    vulnerabilities: normalized.vulnerabilities,
    likes: normalized.likes,
    dislikes: normalized.dislikes,
    signatureBehaviors: normalized.signatureBehaviors,
    authoredExamples: normalized.authoredExamples,
    legacyAuthoring: normalized.legacyAuthoring,
  });
}

function formatList(items: string[]): string {
  return items.length > 0 ? items.map((item) => `- ${item}`).join('\n') : '- なし';
}

export function buildPersonaCompilerSystemPrompt(): string {
  return `You are a persona compiler for a character-chat system.

Your job is to convert rich human-authored persona material into a short, stable runtime persona.

You are NOT writing dialogue.
You are NOT being creative.
You are extracting durable behavioral structure.

Input fields:
- summary
- innerWorldNoteMd
- values
- vulnerabilities
- likes
- dislikes
- signatureBehaviors
- authoredExamples

Output strict JSON only.

Return JSON with this shape:
{
  "oneLineCore": string,
  "desire": string | null,
  "fear": string | null,
  "protectiveStrategy": string | null,
  "attachmentStyleHint": string | null,
  "conflictPattern": string | null,
  "intimacyPattern": string | null,
  "motivationalHooks": string[],
  "softBans": string[],
  "toneHints": string[]
}

Goals:
1. Capture stable motivations and defenses.
2. Keep the output compact enough to inject every turn.
3. Prefer durable patterns over scene-specific details.
4. Do not copy the freeform note verbatim.
5. Preserve nuance, but compress aggressively.
6. authoredExamples are evidence for tone, not something to summarize away completely.

Writing rules:
- oneLineCore must be one sentence.
- desire/fear/protectiveStrategy should be short.
- toneHints should be brief phrase fragments, not full sentences.
- motivationalHooks should describe what tends to make the character more receptive, warmer, or more engaged.
- softBans should describe character-level landmines or aversive directions, not policy or legal categories.
- If information is weak or missing, use null instead of inventing detail.
- Be precise and low-drama.`;
}

export function buildPersonaCompilerUserPrompt(persona: PersonaAuthoring): string {
  const exampleBlocks = AUTHORED_EXAMPLE_KEYS.map((key) => {
    const examples = persona.authoredExamples[key];
    return `<tone_examples name="${key}">\n${examples?.join('\n') || '(none)'}\n</tone_examples>`;
  }).join('\n');

  return `<task>
Convert this designer-authored persona into compact runtime JSON.
</task>

<input_fields>
- summary
- innerWorldNoteMd
- values
- vulnerabilities
- likes
- dislikes
- signatureBehaviors
- authoredExamples
</input_fields>

<constraints>
- summary / innerWorldNoteMd / authoredExamples are evidence, not output text to copy.
- Keep scalar fields short and arrays low-token.
- Prefer durable patterns over scene-specific details.
- Do not quote or restate the freeform note line-by-line.
</constraints>

<output_shape>
{
  "oneLineCore": string,
  "desire": string | null,
  "fear": string | null,
  "protectiveStrategy": string | null,
  "attachmentStyleHint": string | null,
  "conflictPattern": string | null,
  "intimacyPattern": string | null,
  "motivationalHooks": string[],
  "softBans": string[],
  "toneHints": string[]
}
</output_shape>

<persona>
  <summary>${persona.summary || '(empty)'}</summary>
  <inner_world_note>${persona.innerWorldNoteMd ?? '(none)'}</inner_world_note>
  <values>
${formatList(persona.values)}
  </values>
  <vulnerabilities>
${formatList(persona.vulnerabilities)}
  </vulnerabilities>
  <likes>
${formatList(persona.likes ?? [])}
  </likes>
  <dislikes>
${formatList(persona.dislikes ?? [])}
  </dislikes>
  <signature_behaviors>
${formatList(persona.signatureBehaviors ?? [])}
  </signature_behaviors>
${exampleBlocks}
</persona>`;
}

export async function compilePersonaAuthoring(
  persona: PersonaAuthoring
): Promise<CompiledPersona> {
  const registry = getProviderRegistry();
  const model = registry.getModel('maintenanceFast');

  const result = await generateObject({
    model,
    schema: CompiledPersonaSchema,
    system: buildPersonaCompilerSystemPrompt(),
    prompt: buildPersonaCompilerUserPrompt(persona),
  });

  return CompiledPersonaSchema.parse(result.object);
}

export type PersonaCompiler = (
  persona: PersonaAuthoring
) => Promise<CompiledPersona>;

export async function preparePublishedPersona(
  input: unknown,
  options: {
    compilePersona?: PersonaCompiler;
  } = {}
): Promise<RuntimePersona> {
  const normalized = normalizeRuntimePersona(input);

  if (normalized.compiledPersona) {
    return normalized;
  }

  const compilePersona = options.compilePersona ?? compilePersonaAuthoring;
  const compiledPersona = await compilePersona(toPersonaAuthoring(normalized));

  return RuntimePersonaSchema.parse({
    ...normalized,
    compiledPersona,
  });
}
