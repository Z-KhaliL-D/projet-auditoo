import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { followSystemTheme } from "./lib/theme";
import { registerServiceWorker } from "./pwa/register";
import { requestPersistentStorage } from "./pwa/storage";
import { syncEngine } from "./sync/instance";
import "./index.css";

followSystemTheme();
syncEngine.start();

const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);

// Production only: in development a cached shell would hide changes. Registering after
// load keeps the install work off the critical path and lets the toaster mount first.
if (import.meta.env.PROD) {
  void requestPersistentStorage();
  window.addEventListener("load", () => void registerServiceWorker());
}
