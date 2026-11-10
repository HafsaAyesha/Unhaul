import { repo } from './repo';
import type { StorageRequest, StorageResponse, StorageResults, StorageOperation } from '../shared/storage-messages';
async function execute(request: StorageRequest): Promise<StorageResults[StorageOperation]> {
  switch (request.operation) {
    case 'initializeStorage': await repo.initializeStorage(); return null;
    case 'getSettings': return repo.getSettings();
    case 'setConsent': await repo.setConsent(request.args[0]); return null;
    case 'getItems': return repo.getItems();
    case 'addItem': await repo.addItem(request.args[0]); return null;
    case 'deleteItem': await repo.deleteItem(request.args[0]); return null;
    case 'loadSampleItems': return repo.loadSampleItems();
    case 'getSavedItems': return repo.getSavedItems();
    case 'setSavedItems': await repo.setSavedItems(request.args[0]); return null;
    case 'getVisits': return repo.getVisits();
    case 'setVisits': await repo.setVisits(request.args[0]); return null;
    case 'getClassificationCache': return repo.getClassificationCache();
    case 'setClassificationCache': await repo.setClassificationCache(request.args[0]); return null;
    case 'deleteAllUnhaulData': await repo.deleteAllUnhaulData(); return null;
    case 'upsertSaved': return repo.upsertSaved(request.args[0]);
    case 'recordVisit': await repo.recordVisit(request.args[0]); return null;
    case 'setSavedStatus': await repo.setSavedStatus(request.args[0].id, request.args[0].status); return null;
    case 'setMonthlyBudget': await repo.setMonthlyBudget(request.args[0]); return null;
  }
}
export async function dispatchStorage(request: StorageRequest): Promise<StorageResponse> {
  try { return { ok: true, value: await execute(request) }; }
  catch (error) {
    return { ok: false, error: { code: 'STORAGE_ERROR', message: error instanceof Error ? error.message : 'Unhaul storage operation failed.' } };
  }
}
