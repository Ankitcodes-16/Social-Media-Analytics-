import { MOCK_LATENCY_MS } from "./config";

/**
 * Runs a synchronous query against the simulated dataset behind an artificial
 * delay, so loading states are real and visible.
 *
 * Dev aid: append `?mock_error=1` to any page URL to make simulated services
 * fail, which exercises every page's error state.
 */
export async function mockCall<T>(query: () => T): Promise<T> {
  await new Promise<void>((resolve) => setTimeout(resolve, MOCK_LATENCY_MS));
  if (typeof window !== "undefined" && new URLSearchParams(window.location.search).has("mock_error")) {
    throw new Error("Simulated service failure (the mock_error flag is present in the URL).");
  }
  return query();
}
