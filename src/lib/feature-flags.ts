const ENABLED_VALUES = new Set(['1', 'true', 'yes', 'on']);

export function isCoEIntegratorEnabled(
  env: NodeJS.ProcessEnv = process.env
): boolean {
  const raw = env.YUMEKANO_USE_COE_INTEGRATOR;
  if (!raw) {
    return false;
  }

  return ENABLED_VALUES.has(raw.trim().toLowerCase());
}

export function shouldCompareLegacyEmotionPath(
  env: NodeJS.ProcessEnv = process.env
): boolean {
  return isCoEIntegratorEnabled(env);
}
