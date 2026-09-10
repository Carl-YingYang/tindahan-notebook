/** Dependency-free cuid-ish id: timestamp + random, URL-safe. */
export function newId(): string {
  const time = Date.now().toString(36);
  let rand = "";
  for (let i = 0; i < 12; i++) {
    rand += Math.floor(Math.random() * 36).toString(36);
  }
  return `c${time}${rand}`;
}
