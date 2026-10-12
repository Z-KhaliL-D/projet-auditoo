import {
  type Op,
  type PullResponse,
  type PushResponse,
  pullResponseSchema,
  pushResponseSchema,
} from "@auditoo/shared";
import type { ZodType } from "zod";

// The request never produced a usable answer: network down, timeout, or a body that
// is not JSON (a captive portal answers 200 with HTML). All of these mean "offline".
export class OfflineError extends Error {}

// The server answered, but not with what we expected.
export class ServerError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export interface Transport {
  push(ops: Op[]): Promise<PushResponse>;
  pull(since: number): Promise<PullResponse>;
}

const TIMEOUT_MS = 15_000;

export function httpTransport(
  fetchFn: typeof fetch = (input, init) => fetch(input, init),
  timeoutMs = TIMEOUT_MS,
): Transport {
  // A fetch on a bad mobile network can hang forever, so every request has a deadline
  // that also covers reading the body.
  async function request<T>(schema: ZodType<T>, url: string, init?: RequestInit): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetchFn(url, { ...init, signal: controller.signal });
      if (!res.ok) throw new ServerError(res.status, `HTTP ${res.status}`);
      const parsed = schema.safeParse(await res.json());
      if (!parsed.success) throw new ServerError(res.status, "malformed response");
      return parsed.data;
    } catch (err) {
      if (err instanceof ServerError) throw err;
      throw new OfflineError("request failed");
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    push: (ops) =>
      request(pushResponseSchema, "/api/sync/push", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ops }),
      }),
    pull: (since) => request(pullResponseSchema, `/api/sync/pull?since=${since}`),
  };
}
