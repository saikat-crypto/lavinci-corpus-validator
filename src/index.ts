/**
 * ============================================================
 * LA VINCI — CORPUS VALIDATOR INDEX
 * ============================================================
 * Public API for the corpus validation harness.
 * Import from here in test runner scripts.
 */

export type {
  CorpusManifest,
  CorpusManifestEntry,
  DwgVersion,
  SourceCategory,
  SizeDecile,
  CorpusPartition,
  ExternalDependencyStatus,
} from './corpusManifest.js';

export type {
  TestStatusCode,
  DiagnosticCode,
  StructuredDiagnostic,
  Spoke1Result,
  Spoke2Result,
  Spoke3Result,
  Spoke4Result,
  CrossSpokeOracleResult,
  TestResultRecord,
  CorpusRunSummary,
} from './testResultSchema.js';

export {
  readDwgHeaderVersion,
  computeSha256,
  assignSizeDeciles,
  assignPartitions,
  buildCorpusManifest,
} from './manifestBuilder.js';
