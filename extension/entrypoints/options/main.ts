import { browser } from 'wxt/browser';
import { repo } from '../../src/storage/repo';
import { sampleItems } from '../../src/storage/sample-items';
import './style.css';
async function render() {
  const list = document.querySelector<HTMLUListElement>('#items')!;
  list.replaceChildren();
  for (const item of await repo.getItems()) {
    const li = document.createElement('li');
    li.textContent = `${item.name} — ${item.itemType}`;
    list.append(li);
  }
}
document.querySelector('#load-sample')!.addEventListener('click', async () => {
  const items = await repo.getItems();
  const merged = new Map(items.map(item => [item.id, item]));
  for (const item of sampleItems) if (!merged.has(item.id)) merged.set(item.id, item);
  await repo.setItems([...merged.values()]);
  await render();
});
document.querySelector('#delete-data')!.addEventListener('click', async () => {
  await browser.storage.local.clear();
  document.querySelector('#status')!.textContent = 'All Unhaul data deleted.';
  await render();
});
void render();
