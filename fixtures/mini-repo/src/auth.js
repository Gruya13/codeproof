export async function rotate(store, userId, token) {
  store.save(userId, token);
  return store.get(userId);
}
