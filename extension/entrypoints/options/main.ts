import { storageClient } from '../../src/storage/client';
import './style.css';
const list = document.querySelector<HTMLUListElement>('#items')!;
const status = document.querySelector<HTMLParagraphElement>('#status')!;
const controls = [...document.querySelectorAll<HTMLButtonElement>('button')];
let busy = false;
async function render(): Promise<void> {
  const items = await storageClient.getItems();
  const rows = items.map(item => {
    const li = document.createElement('li');
    li.textContent = `${item.name} — ${item.itemType}`;
    return li;
  });
  list.replaceChildren(...rows);
}
async function perform(action: () => Promise<string>): Promise<void> {
  if (busy) return;
  busy = true;
  controls.forEach(button => { button.disabled = true; });
  status.setAttribute('role', 'status');
  status.textContent = 'Working…';
  try { status.textContent = await action(); }
  catch (error) {
    status.setAttribute('role', 'alert');
    status.textContent = error instanceof Error ? error.message : 'Unhaul could not complete this action. Please retry.';
  } finally {
    busy = false;
    controls.forEach(button => { button.disabled = false; });
  }
}
document.querySelector('#load-sample')!.addEventListener('click', () => {
  void perform(async () => {
    const count = await storageClient.loadSampleItems();
    await render();
    return count ? `Added ${count} sample items.` : 'Sample items are already loaded.';
  });
});
document.querySelector('#delete-data')!.addEventListener('click', () => {
  void perform(async () => {
    await storageClient.deleteAllUnhaulData();
    await render();
    return 'All Unhaul data deleted.';
  });
});
void perform(async () => { await render(); return ''; });
