import type { Op, PullResponse } from "@auditoo/shared";
import { createApp } from "./app";
import { createDb } from "./db";

export function setup() {
  const db = createDb(":memory:");
  const app = createApp(db);

  const push = (ops: unknown[]) =>
    app.request("/api/sync/push", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ops }),
    });

  const pull = async (since = 0) => {
    const res = await app.request(`/api/sync/pull?since=${since}`);
    return res.json() as Promise<PullResponse>;
  };

  return { db, app, push, pull };
}

const meta = () => ({ opId: crypto.randomUUID(), createdAt: 1 });

export const ops = {
  levelCreate: (id: string, name = "L", rank = "a0"): Op => ({ ...meta(), type: "level.create", payload: { id, name, rank } }),
  levelRename: (id: string, name: string): Op => ({ ...meta(), type: "level.rename", payload: { id, name } }),
  levelMove: (id: string, rank: string): Op => ({ ...meta(), type: "level.move", payload: { id, rank } }),
  levelDelete: (id: string): Op => ({ ...meta(), type: "level.delete", payload: { id } }),
  spaceCreate: (id: string, levelId: string, name = "S", rank = "a0"): Op => ({ ...meta(), type: "space.create", payload: { id, levelId, name, rank } }),
  spaceRename: (id: string, name: string): Op => ({ ...meta(), type: "space.rename", payload: { id, name } }),
  spaceMove: (id: string, levelId: string, rank: string): Op => ({ ...meta(), type: "space.move", payload: { id, levelId, rank } }),
  spaceDelete: (id: string): Op => ({ ...meta(), type: "space.delete", payload: { id } }),
};

export const uuid = () => crypto.randomUUID();
