import { performance } from "node:perf_hooks";

function isDevelopment() {
  return process.env.NODE_ENV !== "production";
}

export async function measureAsync<T>(label: string, task: () => Promise<T>): Promise<T> {
  if (!isDevelopment()) return task();
  const start = performance.now();
  try {
    return await task();
  } finally {
    const durationMs = performance.now() - start;
    console.info(`[dev-bench] ${label}: ${durationMs.toFixed(1)}ms`);
  }
}
