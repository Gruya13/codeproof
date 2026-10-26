export interface SessionStore {
  save(userId: string, token: string): Promise<void>;
  get(userId: string): Promise<string | undefined>;
}

export async function rotateToken(
  store: SessionStore,
  userId: string,
  token: string,
): Promise<string | undefined> {
  store.save(userId, token);
  return store.get(userId);
}

export async function readToken(store: SessionStore, userId: string): Promise<string | undefined> {
  return store.get(userId);
}
