// Board ids double as URL segments (/boards/:boardId) and select values, so a name typed by a
// user is normalised to a lowercase, hyphenated slug: "Q4 Launch!" → "q4-launch".
export function toBoardId(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}
