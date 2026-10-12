/// <reference lib="webworker" />
import { NavigationRoute, NetworkOnly, type PrecacheEntry, Serwist, type SerwistGlobalConfig } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

// Data lives in Dexie and the sync engine owns the network. A cached sync answer could
// make the client delete outbox ops the server never received, so /api is never cached,
// for any method. Keep this rule first: nothing registered after it can capture /api.
const API = ({ url }: { url: URL }) => url.pathname.startsWith("/api/");
const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  // A new version waits until the inspector chooses to reload (see the update prompt),
  // so an open page never runs old code against new files.
  skipWaiting: false,
  // Only matters for the very first install, so the first session is already offline-ready.
  clientsClaim: true,
  navigationPreload: false,
  runtimeCaching: METHODS.map((method) => ({ matcher: API, handler: new NetworkOnly(), method })),
});

// Every other navigation gets the precached shell, so the app opens with no network.
serwist.registerRoute(
  new NavigationRoute(serwist.createHandlerBoundToUrl("/index.html"), { denylist: [/^\/api\//] }),
);

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") void self.skipWaiting();
});

serwist.addEventListeners();
