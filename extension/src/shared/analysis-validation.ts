import { record, isClassification, isOwnedItem } from './storage-validation';
import type { AnalysisResult } from './types';
export function isAnalysisResult(value: unknown): value is AnalysisResult {
  return record(value) && value.type === 'MATCH_RESULT' && typeof value.productId === 'string'
    && typeof value.analysisId === 'string' && isClassification(value.classification)
    && Array.isArray(value.matches) && value.matches.length <= 3
    && value.matches.every(match => record(match) && isOwnedItem(match.item) && ['strong', 'weak'].includes(String(match.strength)) && typeof match.reason === 'string')
    && typeof value.totalMatches === 'number' && Number.isSafeInteger(value.totalMatches) && value.totalMatches >= value.matches.length
    && typeof value.question === 'string' && typeof value.repeatVisit === 'boolean'
    && ['basic', 'cached', 'ai', 'fallback'].includes(String(value.phase)) && typeof value.refinementAvailable === 'boolean';
}
