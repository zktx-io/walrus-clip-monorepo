export function generateRandomId() {
  const rand = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(rand)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
