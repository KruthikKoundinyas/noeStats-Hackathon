const tails = new Map();

// Serializes mutations for one key inside this Node process. This closes local
// read-then-write races, but is deliberately not treated as a database transaction.
export async function withMutationLock(key, operation) {
  const previous = tails.get(key) || Promise.resolve();
  let release;
  const current = new Promise((resolve) => { release = resolve; });
  tails.set(key, current);
  await previous.catch(() => {});
  try {
    return await operation();
  } finally {
    release();
    if (tails.get(key) === current) tails.delete(key);
  }
}
