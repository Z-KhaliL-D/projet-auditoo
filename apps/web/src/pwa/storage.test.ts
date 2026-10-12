import { describe, expect, it, vi } from "vitest";
import { requestPersistentStorage } from "./storage";

const manager = (over: Partial<StorageManager>) => over as StorageManager;

describe("requestPersistentStorage", () => {
  it("asks for persistence when it is not granted yet", async () => {
    const persist = vi.fn(async () => true);
    const result = await requestPersistentStorage(manager({ persisted: async () => false, persist }));
    expect(result).toBe(true);
    expect(persist).toHaveBeenCalledTimes(1);
  });

  it("does not ask again when already persistent", async () => {
    const persist = vi.fn(async () => true);
    const result = await requestPersistentStorage(manager({ persisted: async () => true, persist }));
    expect(result).toBe(true);
    expect(persist).not.toHaveBeenCalled();
  });

  it("reports a refusal", async () => {
    expect(await requestPersistentStorage(manager({ persisted: async () => false, persist: async () => false }))).toBe(false);
  });

  it("is false when the browser has no storage manager or persist()", async () => {
    expect(await requestPersistentStorage(undefined)).toBe(false);
    expect(await requestPersistentStorage(manager({}))).toBe(false);
  });

  it("swallows errors", async () => {
    const broken = manager({
      persisted: async () => {
        throw new Error("denied");
      },
      persist: async () => true,
    });
    expect(await requestPersistentStorage(broken)).toBe(false);
  });
});
