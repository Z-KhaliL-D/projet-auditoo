import { db } from "@/data/db";
import { createSyncEngine } from "./engine";
import { httpTransport } from "./http";

export const syncEngine = createSyncEngine({ db, transport: httpTransport() });
