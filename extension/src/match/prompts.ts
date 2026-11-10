export function choosePrompt(similarCount: number): string {
  return similarCount > 0
    ? 'What would this add beyond what you already own?'
    : 'Would you still want this after three days?';
}
