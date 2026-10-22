/**
 * Purchases are optional during app startup. OSS/test builds don't have the
 * RevenueCat API keys used by the official Android release workflow.
 */
export async function configurePurchasesIfAvailable(
  apiKey: string | undefined,
  configure: (key: string) => void | Promise<void>,
  logFailure: (message: string, error?: unknown) => void,
): Promise<boolean> {
  if (!apiKey?.trim()) {
    logFailure('RevenueCat API key is missing; purchases are disabled for this build');
    return false;
  }

  try {
    await configure(apiKey);
    return true;
  } catch (error) {
    logFailure('RevenueCat could not initialize; purchases are disabled for this session', error);
    return false;
  }
}
