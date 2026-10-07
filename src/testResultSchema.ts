/**
 * ============================================================
 * LA VINCI — TEST RESULT TAXONOMY SCHEMA
 * ============================================================
 *
 * Defines every possible outcome classification, diagnostic code,
 * and structured result record for a single DWG file passing
 * through the 4-spoke La Vinci pipeline.
 *
 * Core principle from mentor: Never collapse execution success
 * and fidelity confidence into a single green checkmark.
 */

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 1: FINAL STATUS TAXONOMY
// This is the top-level classification for any test result.
// Defined exactly as specified by the technical architecture mentor.
// ─────────────────────────────────────────────────────────────────────────────
export type TestStatusCode =
  // ── Happy paths ────────────────────────────────────────────────────────────
  | 'CLEAN_PASS'
  //   No known degradation or warnings. All invariants satisfied.
  //   Both execution success AND full fidelity confidence.

  | 'PASS_WITH_DIAGNOSTICS'
  //   Output is valid and usable, but explicit, known degradation occurred.
  //   e.g. a font was substituted, a proxy entity was preserved verbatim,
  //   an XREF was missing but recorded. Still a valid delivery.

  // ── Source problems (not La Vinci's fault) ─────────────────────────────────
  | 'SOURCE_INVALID'
  //   The DWG file is corrupt, truncated, or not a real DWG.
  //   Excluded from denominator for La Vinci quality metrics.

  | 'SOURCE_UNSUPPORTED'
  //   A valid file, but outside the established support boundary.
  //   e.g. DWG version AC1009 (R12), which LibreDWG cannot parse.

  // ── Spoke-specific failures ────────────────────────────────────────────────
  | 'S1_DECODE_FAILURE'
  //   LibreDWG crashed, timed out, or returned an unparseable response.
  //   The DWG bytes were never successfully converted to any IR.

  | 'S1_IR_FAILURE'
  //   LibreDWG decoded the source, but the semantic IR compiler
  //   failed an invariant (NaN coordinates, handle collision, etc.)

  | 'S2_RENDER_FAILURE'
  //   A valid IR was produced but the SVG compiler crashed or produced
  //   invalid/unparseable SVG output.

  | 'S3_RENDER_FAILURE'
  //   A valid IR was produced but the raster encoder (PNG/JPEG/etc.)
  //   crashed or produced a corrupt/blank image.

  | 'S4_RENDER_FAILURE'
  //   A valid IR was produced but the PDF compiler crashed or produced
  //   an invalid/unreadable PDF file.

  // ── Reliability / Infrastructure failures ─────────────────────────────────
  | 'RESOURCE_LIMIT'
  //   The test harness intentionally terminated the job because it
  //   exceeded CPU time, memory, or output-size limits.

  | 'NONDETERMINISTIC'
  //   The same file, same code, same config produced materially different
  //   output across consecutive runs. This is a serious reliability failure.

  | 'VISUAL_MISMATCH'
  //   The pipeline succeeded structurally, but external visual inspection
  //   (compared to a trusted independent renderer) found a meaningful
  //   discrepancy. Only applies to files in the visual audit subset.

  | 'HARNESS_FAILURE';
  //   The test infrastructure itself failed (e.g. a script crash,
  //   filesystem error). The file is not counted as tested.

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 2: DIAGNOSTIC CODES
// Fine-grained codes emitted by each spoke. Multiple codes can be
// attached to a single result. They feed the "taxonomy" breakdown.
// ─────────────────────────────────────────────────────────────────────────────
export type DiagnosticCode =
  // Spoke 1 — IR Extraction
  | 'IR_NAN_COORDINATE'         // A geometry field contained NaN or Infinity
  | 'IR_UNACCOUNTED_ENTITIES'   // audit.unaccounted > 0
  | 'IR_HANDLE_COLLISION'       // Two entities share the same DWG source handle
  | 'IR_MISSING_BLOCK_DEF'      // An INSERT references a non-existent block definition
  | 'IR_MISSING_LAYER_REF'      // An entity references a layer not in the layer table
  | 'IR_INVALID_EXTENTS'        // Model extents are NaN, Infinite, or zero-area
  | 'IR_PROXY_ENTITY_PRESERVED' // A third-party proxy entity was preserved (not an error, but logged)
  | 'IR_XREF_MISSING'           // An XREF dependency was referenced but not available
  | 'IR_XREF_RESOLVED'          // An XREF dependency was found and recorded
  | 'IR_DECODE_TIMEOUT'         // LibreDWG exceeded the CPU time limit
  | 'IR_DECODE_OOM'             // LibreDWG process exceeded the memory limit
  | 'IR_SPLINE_INCOHERENT'      // Spline knot/control-point arrays are mathematically incoherent
  | 'IR_INVALID_ARC_RADIUS'     // Circle or arc has a zero or negative radius
  | 'IR_POLYLINE_INFINITE_BULGE'// A polyline bulge factor is not finite

  // Spoke 2 — SVG
  | 'SVG_INVALID_XML'           // Output is not well-formed XML
  | 'SVG_NAN_IN_PATH'           // A path 'd' attribute contains NaN or Infinity
  | 'SVG_INVALID_VIEWBOX'       // viewBox is missing, zero-area, or non-finite
  | 'SVG_UNRESOLVED_USE'        // A <use> element references a non-existent <symbol>
  | 'SVG_ENTITY_COUNT_MISMATCH' // IR entity count vs SVG rendered count diverged
  | 'SVG_EMPTY_OUTPUT'          // SVG contains no visual geometry (but IR was non-empty)
  | 'SVG_HIDDEN_LAYER_LEAKED'   // A hidden/frozen layer entity appeared in the render

  // Spoke 3 — Raster
  | 'RASTER_OOM_CLAMPED'        // Resolution multiplier was clamped by the OOM shield
  | 'RASTER_BLANK_IMAGE'        // Output image is blank/near-blank when SVG was not
  | 'RASTER_CORRUPT_ENCODING'   // Image buffer failed format validation
  | 'RASTER_ASPECT_MISMATCH'    // Output dimensions don't match expected aspect ratio
  | 'RASTER_NONDETERMINISTIC'   // Two renders of the same IR produced different pixel hashes
  | 'RASTER_NATIVE_CRASH'       // The native resvg/sharp binding crashed

  // Spoke 4 — PDF
  | 'PDF_UNSUPPORTED_ENTITY'    // An IR entity type has no PDF representation
  | 'PDF_FONT_SUBSTITUTION'     // A DWG font was replaced with a fallback
  | 'PDF_MISSING_DEPENDENCY'    // A required asset (font, image) could not be resolved
  | 'PDF_CORRUPT_OUTPUT'        // The PDF buffer failed structural validation
  | 'PDF_RASTER_ONLY'           // PDF contains only embedded images, no vector content
  | 'PDF_PAGE_FRAMING_ERROR'    // Drawing is clipped, padded incorrectly, or zero-size
  | 'PDF_BLANK_PAGE'            // Output is a valid PDF but contains no visible content
  | 'PDF_TEXT_NOT_SELECTABLE'   // Text exists in IR but is not selectable in the PDF

  // Cross-spoke
  | 'CROSS_ENTITY_COUNT_DROP'   // Spoke 2/3/4 rendered significantly fewer entities than Spoke 1 reported
  | 'CROSS_VISUAL_DEVIATION'    // Perceptual comparison between SVG/raster/PDF exceeded threshold
  | 'CROSS_ASPECT_RATIO_DRIFT'; // The aspect ratio changed between spokes

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 3: STRUCTURED DIAGNOSTIC
// A single emitted diagnostic. Multiple can appear in one result.
// ─────────────────────────────────────────────────────────────────────────────
export interface StructuredDiagnostic {
  code: DiagnosticCode;
  message: string;
  /** Which spoke emitted this diagnostic (1-4, or 0 for cross-spoke) */
  spoke: 0 | 1 | 2 | 3 | 4;
  /** Entity ID, layer name, or other context-specific reference */
  reference?: string;
  /** Extra machine-readable data (e.g. measured vs expected value) */
  detail?: Record<string, unknown>;
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 4: SPOKE-LEVEL RESULT RECORDS
// Each spoke produces its own structured result block.
// ─────────────────────────────────────────────────────────────────────────────

export interface Spoke1Result {
  status: 'ok' | 'failed' | 'skipped';
  durationMs: number;

  /** audit.fieldDispositions.unaccounted from the IR */
  unaccountedEntities: number;
  totalEntitiesInIr: number;
  blockDefinitionCount: number;
  blockInstanceCount: number;
  layerCount: number;
  textEntityCount: number;
  proxyEntityCount: number;
  splineCount: number;
  ellipseCount: number;
  entityTypesPresent: string[];

  /** Were all geometry coordinates finite (no NaN/Inf)? */
  allCoordinatesFinite: boolean;

  /** Were all block references resolvable? */
  allBlockRefsResolved: boolean;

  /** Were all layer references resolvable? */
  allLayerRefsResolved: boolean;

  /** Are model extents present and finite? */
  extentsValid: boolean;

  dwgVersion: string;
  diagnostics: StructuredDiagnostic[];
  errorMessage?: string;
}

export interface Spoke2Result {
  status: 'ok' | 'failed' | 'skipped';
  durationMs: number;
  preset: string;

  svgByteSize: number;
  viewBoxWidth: number;
  viewBoxHeight: number;
  renderedEntityCount: number;

  /** Was the output well-formed XML? */
  validXml: boolean;

  /** Were all <use> hrefs resolvable inside the SVG? */
  allUsesResolved: boolean;

  /** Did entity count reconcile with Spoke 1's IR count (within threshold)? */
  entityCountReconciled: boolean;

  diagnostics: StructuredDiagnostic[];
  errorMessage?: string;
}

export interface Spoke3Result {
  status: 'ok' | 'failed' | 'skipped';
  durationMs: number;
  format: string;
  resolutionMultiplier: number;

  outputWidthPx: number;
  outputHeightPx: number;
  byteSize: number;

  /** Was the OOM safety clamp triggered? */
  oomClampTriggered: boolean;

  /** Is the image non-blank (has sufficient foreground pixels)? */
  isNonBlank: boolean;

  /** SHA-256 of the pixel buffer (for determinism check) */
  pixelHash?: string;

  diagnostics: StructuredDiagnostic[];
  errorMessage?: string;
}

export interface Spoke4Result {
  status: 'ok' | 'failed' | 'skipped';
  durationMs: number;
  preset: string;
  pageSize: string;

  outputByteSize: number;
  pageWidthMm: number;
  pageHeightMm: number;
  renderedEntityCount: number;

  /** Is the PDF parseable (has valid header/xref/trailer)? */
  validPdfStructure: boolean;

  /** Does it contain real vector content (not just embedded images)? */
  hasVectorContent: boolean;

  /** Does it have selectable text where the IR had text entities? */
  hasSelectableText: boolean;

  /** La Vinci's own diagnostic status for this render */
  laVinciStatus: 'ok' | 'partial';

  diagnostics: StructuredDiagnostic[];
  errorMessage?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 5: CROSS-SPOKE ORACLE RESULTS
// Comparisons that can only be made after all spokes have run.
// ─────────────────────────────────────────────────────────────────────────────
export interface CrossSpokeOracleResult {
  /** Entity count reported by Spoke 1 IR vs entities rendered by Spoke 2 SVG */
  entityCountDrop: number;
  entityCountDropPct: number;

  /** Aspect ratio of SVG viewBox vs final PDF page */
  svgAspectRatio: number;
  pdfAspectRatio: number;
  aspectRatioDriftPct: number;

  /** Perceptual comparison result (if visual oracle was run) */
  visualOracle?: {
    ssim: number;           // 0-1, higher is more similar
    pixelDiffPct: number;   // % of pixels that differ beyond threshold
    edgeMapOverlapPct: number;
    verdict: 'accepted' | 'mismatch';
    notes?: string;
  };

  diagnostics: StructuredDiagnostic[];
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 6: MASTER TEST RESULT RECORD
// One of these exists for every CorpusManifestEntry that was tested.
// ─────────────────────────────────────────────────────────────────────────────
export interface TestResultRecord {
  schemaVersion: '1.0.0';

  /** Matches CorpusManifestEntry.corpusId */
  corpusId: string;

  /** SHA-256 of the DWG (cross-reference with manifest) */
  sha256: string;

  /** ISO 8601 timestamp when this test run started */
  runStartedAt: string;

  /** ISO 8601 timestamp when all spokes completed */
  runCompletedAt: string;

  /** Total wall-clock time across all spokes (ms) */
  totalDurationMs: number;

  /**
   * The single authoritative status code for this file.
   * This is the ONLY field that should be aggregated into headline numbers.
   */
  finalStatus: TestStatusCode;

  /**
   * Short human-readable summary of why this status was assigned.
   */
  statusReason: string;

  /**
   * Fidelity confidence score (0-100, separate from execution success).
   * 100 = all entities accounted for, no degradation detected.
   * 0   = output exists but no confidence it reflects source content.
   * null = could not be measured (e.g. source was invalid).
   */
  fidelityScore: number | null;

  /** Results from each spoke (null if that spoke was not reached/run) */
  s1: Spoke1Result | null;
  s2: Spoke2Result | null;
  s3: Spoke3Result | null;
  s4: Spoke4Result | null;

  /** Cross-spoke oracle results (null if multiple spokes didn't produce output) */
  crossSpoke: CrossSpokeOracleResult | null;

  /** All diagnostics from all spokes, merged and deduplicated */
  allDiagnostics: StructuredDiagnostic[];

  /** Git commit SHA of the La Vinci compiler at test time */
  compilerCommit: string;

  /** Node.js runtime version */
  nodeVersion: string;

  /** OS platform identifier */
  platform: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 7: CORPUS RUN SUMMARY
// Aggregated metrics produced at the end of a full corpus run.
// ─────────────────────────────────────────────────────────────────────────────
export interface CorpusRunSummary {
  schemaVersion: '1.0.0';
  runId: string;         // UUID for this specific corpus run
  runStartedAt: string;
  runCompletedAt: string;
  totalDurationMs: number;

  /** Snapshot of exact compiler commit SHAs for all 4 spokes */
  compilerSnapshot: {
    spoke1Commit: string;
    spoke2Commit: string;
    spoke3Commit: string;
    spoke4Commit: string;
    libRedwgVersion: string;
    nodeVersion: string;
    platform: string;
  };

  /** Corpus statistics */
  corpus: {
    totalFilesInManifest: number;
    testedCount: number;
    skippedCount: number;
    partition: 'development' | 'validation' | 'holdout' | 'all';
  };

  /** Headline result counts — by status code */
  resultsByStatus: Partial<Record<TestStatusCode, number>>;

  /** Spoke-level pass/fail breakdown */
  spokeResults: {
    s1: { passed: number; failed: number; skipped: number };
    s2: { passed: number; failed: number; skipped: number };
    s3: { passed: number; failed: number; skipped: number };
    s4: { passed: number; failed: number; skipped: number };
  };

  /** Top diagnostic codes by frequency */
  topDiagnostics: { code: DiagnosticCode; count: number }[];

  /** Breakdown by DWG version */
  resultsByDwgVersion: Record<string, { total: number; cleanPass: number; failures: number }>;

  /** Breakdown by file size decile */
  resultsBySizeDecile: Record<string, { total: number; cleanPass: number; failures: number }>;

  /** Breakdown by source category */
  resultsByCategory: Partial<Record<string, { total: number; cleanPass: number; failures: number }>>;

  /** Average fidelity score across successfully processed files */
  averageFidelityScore: number | null;

  /** Determinism test results (if run) */
  determinismTest?: {
    filesTestedCount: number;
    nonDeterministicCount: number;
    nonDeterministicCorpusIds: string[];
  };

  /** Visual oracle audit results (if run — only on subset) */
  visualAudit?: {
    filesAuditedCount: number;
    acceptedCount: number;
    mismatchCount: number;
    averageSsim: number;
    mismatchCorpusIds: string[];
  };

  /**
   * The honest claim this run can make.
   * Never claim universal fidelity. Always bound to the tested corpus.
   */
  honestClaim: string;
}
