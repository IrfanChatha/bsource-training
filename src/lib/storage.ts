/**
 * Client storage keys for BSource Training.
 *
 * These were prefixed `traintrack_` before the product was renamed. `readStored`
 * adopts a pre-rename value the first time a key is read, so existing sessions,
 * theme preferences and cached material survive the rename without anyone
 * being signed out.
 */

export const STORAGE_KEYS = {
  theme: "bsource-theme",
  user: "bsource-user",
  activeMaterialText: "bsource-active-material-text",
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];

const LEGACY_KEYS: Record<StorageKey, string> = {
  [STORAGE_KEYS.theme]: "traintrack_theme",
  [STORAGE_KEYS.user]: "traintrack_user",
  [STORAGE_KEYS.activeMaterialText]: "traintrack_active_material_text",
};

/** Reads a key, promoting any pre-rename value to the new key once. */
export function readStored(key: StorageKey): string | null {
  if (typeof window === "undefined") return null;

  try {
    const current = window.localStorage.getItem(key);
    if (current !== null) return current;

    const legacyKey = LEGACY_KEYS[key];
    const legacy = window.localStorage.getItem(legacyKey);
    if (legacy !== null) {
      window.localStorage.setItem(key, legacy);
      window.localStorage.removeItem(legacyKey);
    }
    return legacy;
  } catch {
    // Storage can be unavailable (private mode, blocked cookies).
    return null;
  }
}

export function writeStored(key: StorageKey, value: string): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage can be unavailable (private mode, blocked cookies).
  }
}

/** Clears a key along with the pre-rename key it replaced. */
export function clearStored(key: StorageKey): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.removeItem(key);
    window.localStorage.removeItem(LEGACY_KEYS[key]);
  } catch {
    // Storage can be unavailable (private mode, blocked cookies).
  }
}
