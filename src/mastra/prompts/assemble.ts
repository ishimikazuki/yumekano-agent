import { createHash } from 'node:crypto';

export function assemblePrompt(parts: Array<string | null | undefined>): string {
  return parts
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join('\n\n')
    .trim();
}

export function formatDesignerFragment(
  fragment: string | null | undefined,
  heading = 'Designer Instructions'
): string | null {
  const value = fragment?.trim();
  if (!value) {
    return null;
  }

  return `## ${heading}\n${value}`;
}

export function hashPrompt(prompt: string): string {
  return createHash('sha256').update(prompt).digest('hex');
}
