// Asks the browser not to evict our IndexedDB under storage pressure. Unsynced work
// lives there. Browsers decide without a prompt in most cases, so this is silent.
export async function requestPersistentStorage(storage: StorageManager | undefined = navigator.storage): Promise<boolean> {
  try {
    if (!storage?.persist) return false;
    return (await storage.persisted()) || (await storage.persist());
  } catch {
    return false;
  }
}
