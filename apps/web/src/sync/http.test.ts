import { afterEach, describe, expect, it, vi } from "vitest";
import { OfflineError, ServerError, httpTransport } from "./http";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

afterEach(() => vi.useRealTimers());

describe("httpTransport", () => {
  it("posts ops and parses the push response", async () => {
    const fetchFn = vi.fn(async () => json({ applied: [crypto.randomUUID()], skipped: [] }));
    const res = await httpTransport(fetchFn as unknown as typeof fetch).push([]);
    expect(res.applied).toHaveLength(1);
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/sync/push");
    expect(init.method).toBe("POST");
    expect(init.body).toBe('{"ops":[]}');
  });

  it("passes the cursor to pull", async () => {
    const fetchFn = vi.fn(async () => json({ levels: [], spaces: [], cursor: 7 }));
    await httpTransport(fetchFn as unknown as typeof fetch).pull(3);
    expect((fetchFn.mock.calls[0] as unknown[])[0]).toBe("/api/sync/pull?since=3");
  });

  it("treats a thrown fetch as offline", async () => {
    const t = httpTransport((async () => Promise.reject(new TypeError("Failed to fetch"))) as typeof fetch);
    await expect(t.pull(0)).rejects.toBeInstanceOf(OfflineError);
  });

  it("treats a 200 that is not JSON as offline (captive portal)", async () => {
    const t = httpTransport((async () => new Response("<html>login</html>")) as typeof fetch);
    await expect(t.pull(0)).rejects.toBeInstanceOf(OfflineError);
  });

  it("reports the status of an error response", async () => {
    const t = httpTransport((async () => json({ error: "invalid_request" }, 400)) as typeof fetch);
    await expect(t.push([])).rejects.toMatchObject({ status: 400 });
    await expect(t.push([])).rejects.toBeInstanceOf(ServerError);
  });

  it("rejects a malformed success body as a server error", async () => {
    const t = httpTransport((async () => json({ nope: true })) as typeof fetch);
    await expect(t.pull(0)).rejects.toBeInstanceOf(ServerError);
  });

  it("gives up on a hanging request after the timeout", async () => {
    vi.useFakeTimers();
    const hanging = ((_url: string, init: RequestInit) =>
      new Promise((_, reject) => {
        init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
      })) as unknown as typeof fetch;
    const result = expect(httpTransport(hanging, 15_000).pull(0)).rejects.toBeInstanceOf(OfflineError);
    await vi.advanceTimersByTimeAsync(15_000);
    await result;
  });
});
