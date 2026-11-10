// A: mount within the extension Shadow DOM after consent.
export function createBadge(count: number): HTMLButtonElement {
  const badge = document.createElement('button');
  badge.textContent = `${count} similar items in My Items`;
  return badge;
}
