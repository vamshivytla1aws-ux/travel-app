import { performance } from "node:perf_hooks";

const SLOW_LOG_THRESHOLD_MS = 1000;

function isDevelopment() {
  return process.env.NODE_ENV !== "production";
}

export async function measureAsync<T>(label: string, task: () => Promise<T>): Promise<T> {
  const start = performance.now();
  try {
    return await task();
  } finally {
    const durationMs = performance.now() - start;
    if (isDevelopment()) {
      console.info(`[dev-bench] ${label}: ${durationMs.toFixed(1)}ms`);
    } else if (durationMs >= SLOW_LOG_THRESHOLD_MS) {
      console.info(`[slow-path] ${label}: ${durationMs.toFixed(1)}ms`);
    }
  }
}
