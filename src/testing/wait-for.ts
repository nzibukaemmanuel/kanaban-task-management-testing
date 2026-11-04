/**
 * Retries `assertion` until it stops throwing or `timeout` elapses.
 * Jest has no built-in equivalent of Vitest's `vi.waitFor`.
 */
export async function waitFor<T>(
  assertion: () => T | Promise<T>,
  { timeout = 1000, interval = 10 }: { timeout?: number; interval?: number } = {},
): Promise<T> {
  const deadline = Date.now() + timeout;
  for (;;) {
    try {
      return await assertion();
    } catch (error) {
      if (Date.now() >= deadline) {
        throw error;
      }
      await new Promise<void>((resolve) => setTimeout(resolve, interval));
    }
  }
}
