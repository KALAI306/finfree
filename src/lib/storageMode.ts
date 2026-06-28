// Storage mode: 'local' = IndexedDB on device, 'cloud' = Supabase
export type StorageMode = 'local' | 'cloud';

const KEY = 'finfree_storage_mode';

export function getStorageMode(): StorageMode {
  return (localStorage.getItem(KEY) as StorageMode) || 'cloud';
}

export function setStorageMode(mode: StorageMode) {
  localStorage.setItem(KEY, mode);
}

export function isFirstLaunch(): boolean {
  return localStorage.getItem(KEY) === null;
}
