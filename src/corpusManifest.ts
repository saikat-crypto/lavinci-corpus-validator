/**
 * ============================================================
 * LA VINCI — CORPUS MANIFEST SCHEMA
 * ============================================================
 *
 * Describes a single DWG file that has been admitted into the
 * validation corpus. Every field must be populated BEFORE any
 * spoke is executed against the file.
 *
 * Rules:
 *  - Files are identified by their SHA-256 content hash, NOT filename.
 *  - Duplicate hashes are excluded from the denominator.
 *  - The corpus_id is stable across re-downloads.
 *  - Source URLs are recorded for audit/reproducibility.
 */

// ─────────────────────────────────────────────────────────────────────────────
// CORPUS PARTITION
// Each file belongs to exactly one partition. Fixes are made only against
// DEVELOPMENT files. HOLDOUT files are never opened until final gate.
// ─────────────────────────────────────────────────────────────────────────────
export type CorpusPartition =
  | 'development'   // ~70% — used for active bug fixing
  | 'validation'    // ~15% — periodic health checks during development
  | 'holdout';      // ~15% — sealed until final gate

// ─────────────────────────────────────────────────────────────────────────────
// DWG VERSION
// The AutoCAD/LibreDWG version identifier extracted from the file header.
// ─────────────────────────────────────────────────────────────────────────────
export type DwgVersion =
  | 'R14'       // AC1014
  | '2000'      // AC1015
  | '2004'      // AC1018
  | '2007'      // AC1021
  | '2010'      // AC1024
  | '2013'      // AC1027
  | '2018'      // AC1032
  | 'unknown'
  | string;     // Forward-compatible for future DWG versions

// ─────────────────────────────────────────────────────────────────────────────
// SOURCE CATEGORY
// The engineering domain the file came from (for stratification).
// ─────────────────────────────────────────────────────────────────────────────
export type SourceCategory =
  | 'mechanical'
  | 'architectural'
  | 'civil'
  | 'electrical'
  | 'structural'
  | 'plumbing_hvac'
  | 'symbol_library'
  | 'mixed'
  | 'unknown';

// ─────────────────────────────────────────────────────────────────────────────
// FILE SIZE DECILE
// Stratification bucket based on byte size.
// D1 = smallest 10%, D10 = largest 10%
// ─────────────────────────────────────────────────────────────────────────────
export type SizeDecile = 'D1' | 'D2' | 'D3' | 'D4' | 'D5' | 'D6' | 'D7' | 'D8' | 'D9' | 'D10';

// ─────────────────────────────────────────────────────────────────────────────
// EXTERNAL DEPENDENCY STATUS
// Does the file reference external assets (XREFs, embedded images, etc.)?
// ─────────────────────────────────────────────────────────────────────────────
export type ExternalDependencyStatus =
  | 'none'              // No external references detected
  | 'present_resolved'  // References exist and were found locally
  | 'present_missing'   // References exist but files are not available
  | 'unknown';          // Could not determine

// ─────────────────────────────────────────────────────────────────────────────
// CORPUS MANIFEST ENTRY (One per unique DWG file)
// ─────────────────────────────────────────────────────────────────────────────
export interface CorpusManifestEntry {
  /**
   * Stable unique ID for this file in this corpus.
   * Format: CORP-{zero-padded-index}, e.g. "CORP-0001"
   */
  corpusId: string;

  /**
   * SHA-256 hex digest of the raw file bytes.
   * This is the primary deduplication key.
   */
  sha256: string;

  /**
   * Original filename as downloaded.
   */
  originalFilename: string;

  /**
   * Absolute path to the immutable, read-only copy of this file
   * in the corpus directory.
   */
  immutablePath: string;

  /**
   * File size in bytes.
   */
  byteSize: number;

  /**
   * File size decile bucket (computed after full corpus download).
   */
  sizeDecile: SizeDecile;

  /**
   * Source page URL (e.g. the Bibliocad product page the file came from).
   */
  sourcePageUrl: string;

  /**
   * Direct download URL if different from the page URL.
   */
  downloadUrl?: string;

  /**
   * Engineering domain of this file (manually classified or inferred).
   */
  sourceCategory: SourceCategory;

  /**
   * DWG file format version, read from the first 6 bytes of the file.
   * (e.g. "AC1027" for DWG 2013)
   */
  dwgHeaderVersion: string;

  /**
   * Mapped human-readable version string.
   */
  dwgVersion: DwgVersion;

  /**
   * Whether the file references external assets (XREFs, embedded images).
   */
  externalDependencyStatus: ExternalDependencyStatus;

  /**
   * List of referenced external filenames (from DWG header), if any.
   */
  referencedExternalFiles: string[];

  /**
   * Which partition this file belongs to.
   */
  partition: CorpusPartition;

  /**
   * ISO 8601 timestamp when this file was downloaded and admitted.
   */
  admittedAt: string;

  /**
   * Human notes (unusual features, why this was chosen, etc.)
   */
  notes?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// CORPUS MANIFEST (The full collection)
// ─────────────────────────────────────────────────────────────────────────────
export interface CorpusManifest {
  /**
   * Schema version for forward-compatibility.
   */
  schemaVersion: '1.0.0';

  /**
   * Timestamp this manifest was generated/last updated.
   */
  generatedAt: string;

  /**
   * Total files downloaded (before deduplication).
   */
  totalDownloaded: number;

  /**
   * Number of duplicate files removed by SHA-256 comparison.
   */
  duplicatesRemoved: number;

  /**
   * The authoritative denominator for all test result reporting.
   * uniqueValidCount = totalDownloaded - duplicatesRemoved - invalidSources
   */
  uniqueValidCount: number;

  /**
   * Number of files rejected as corrupt or not genuine DWGs.
   */
  invalidSourcesRemoved: number;

  /**
   * Breakdown by partition.
   */
  partitionCounts: {
    development: number;
    validation: number;
    holdout: number;
  };

  /**
   * Breakdown by DWG version (for stratification reporting).
   */
  versionDistribution: Record<string, number>;

  /**
   * Breakdown by engineering category.
   */
  categoryDistribution: Record<SourceCategory, number>;

  /**
   * The actual list of admitted files.
   */
  entries: CorpusManifestEntry[];
}
