const TOKEN_KEY = '20be-token';
const NAME_KEY = '20be-name';

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/**
 * Random secret that identifies this browser to the room server, so a
 * player who reloads the page gets their seat back. Never shown to others.
 */
export function getPlayerToken(): string {
  const store = storage();
  const saved = store?.getItem(TOKEN_KEY);
  if (saved) return saved;
  const token = crypto.randomUUID().replace(/-/g, '');
  store?.setItem(TOKEN_KEY, token);
  return token;
}

export function getSavedName(): string {
  return storage()?.getItem(NAME_KEY) ?? '';
}

export function saveName(name: string) {
  storage()?.setItem(NAME_KEY, name);
}
