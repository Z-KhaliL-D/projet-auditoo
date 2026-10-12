import "fake-indexeddb/auto";

// jsdom has no matchMedia, which sonner reads on mount.
if (typeof window !== "undefined" && !window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }) as unknown as MediaQueryList;
}

// jsdom lacks pointer capture, which Base UI calls on press.
if (typeof Element !== "undefined") {
  Element.prototype.setPointerCapture ??= () => {};
  Element.prototype.releasePointerCapture ??= () => {};
  Element.prototype.hasPointerCapture ??= () => false;
}
