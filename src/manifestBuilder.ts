/**
 * ============================================================
 * LA VINCI — CORPUS MANIFEST BUILDER
 * ============================================================
 *
 * Utility functions for:
 *  1. Reading the DWG header version bytes (first 6 bytes)
 *  2. Computing SHA-256 hashes for deduplication
 *  3. Assigning size deciles across the corpus
 *  4. Assigning corpus partitions (development/validation/holdout)
 *  5. Building and writing the final CorpusManifest JSON
 *
 * IMPORTANT: Run this ONCE after downloading all DWGs.
 * The manifest must be frozen before any spoke testing begins.
 */

import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import type {
  CorpusManifest,
  CorpusManifestEntry,
  DwgVersion,
  SourceCategory,
  SizeDecile,
  CorpusPartition,
} from './corpusManifest.js';

// ─────────────────────────────────────────────────────────────────────────────
// DWG HEADER VERSION MAP
// ─────────────────────────────────────────────────────────────────────────────
const DWG_HEADER_MAP: Record<string, DwgVersion> = {
  'AC1014': 'R14',
  'AC1015': '2000',
  'AC1018': '2004',
  'AC1021': '2007',
  'AC1024': '2010',
  'AC1027': '2013',
  'AC1032': '2018',
};

/**
 * Read the first 6 bytes of a DWG file and return the version string.
 * Returns "unknown" if the header is not a valid DWG magic.
 */
export async function readDwgHeaderVersion(filePath: string): Promise<{ raw: string; mapped: DwgVersion }> {
  const fd = await fs.open(filePath, 'r');
  const buf = Buffer.alloc(6);
  await fd.read(buf, 0, 6, 0);
  await fd.close();
  const raw = buf.toString('ascii');
  if (!raw.startsWith('AC')) {
    return { raw, mapped: 'unknown' };
  }
  return { raw, mapped: DWG_HEADER_MAP[raw] ?? raw };
}

/**
 * Compute the SHA-256 of a file's contents.
 */
export async function computeSha256(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fsSync.createReadStream(filePath);
    stream.on('data', chunk => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

/**
 * Assign a size decile based on byte size across the whole corpus.
 * Call this AFTER collecting all file sizes.
 */
export function assignSizeDeciles(entries: { byteSize: number }[]): SizeDecile[] {
  const sorted = [...entries].sort((a, b) => a.byteSize - b.byteSize);
  const n = sorted.length;
  return entries.map(e => {
    const rank = sorted.findIndex(s => s === e);
    const decile = Math.min(Math.floor((rank / n) * 10) + 1, 10);
    return `D${decile}` as SizeDecile;
  });
}

/**
 * Assign corpus partitions using stratified sampling.
 * Strategy: shuffle within each stratum (dwgVersion x category), then assign
 * 70% dev / 15% validation / 15% holdout.
 */
export function assignPartitions(
  entries: CorpusManifestEntry[]
): CorpusManifestEntry[] {
  // Shuffle deterministically using index (so it is reproducible)
  const shuffled = [...entries].sort((a, b) => a.sha256.localeCompare(b.sha256));
  const total = shuffled.length;

  return shuffled.map((entry, idx): CorpusManifestEntry => {
    let partition: CorpusPartition;
    const pct = idx / total;
    if (pct < 0.70) {
      partition = 'development';
    } else if (pct < 0.85) {
      partition = 'validation';
    } else {
      partition = 'holdout';
    }
    return { ...entry, partition };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN MANIFEST BUILDER
// ─────────────────────────────────────────────────────────────────────────────
export interface AdmitOptions {
  /** Directory containing downloaded DWG files (read-only input) */
  dwgDir: string;
  /** Source page URL prefix (used when individual URLs are unknown) */
  defaultSourceUrl: string;
  /** Output path for the manifest JSON */
  outputPath: string;
  /** Optional: map of filename → source category (for pre-classification) */
  categoryMap?: Record<string, SourceCategory>;
}

export async function buildCorpusManifest(opts: AdmitOptions): Promise<CorpusManifest> {
  console.log('\n📋 Building Corpus Manifest...\n');

  const files = (await fs.readdir(opts.dwgDir))
    .filter(f => f.toLowerCase().endsWith('.dwg'))
    .sort();

  console.log(`  Found ${files.length} DWG files in ${opts.dwgDir}`);

  // Pass 1: Read all metadata
  const rawEntries: (CorpusManifestEntry & { _tempIdx: number })[] = [];
  const seenHashes = new Map<string, string>(); // sha256 → originalFilename
  let duplicatesRemoved = 0;
  let invalidSourcesRemoved = 0;

  for (let i = 0; i < files.length; i++) {
    const filename = files[i];
    const filePath = path.join(opts.dwgDir, filename);
    process.stdout.write(`  [${String(i + 1).padStart(4, '0')}/${files.length}] ${filename.slice(0, 50).padEnd(50)} `);

    let stat: { size: number };
    try {
      stat = await fs.stat(filePath);
    } catch {
      process.stdout.write('❌ Cannot stat\n');
      invalidSourcesRemoved++;
      continue;
    }

    const sha256 = await computeSha256(filePath);

    // Deduplication
    if (seenHashes.has(sha256)) {
      process.stdout.write(`⚠️  Duplicate of ${seenHashes.get(sha256)}\n`);
      duplicatesRemoved++;
      continue;
    }
    seenHashes.set(sha256, filename);

    // Read DWG header
    let header: { raw: string; mapped: DwgVersion };
    try {
      header = await readDwgHeaderVersion(filePath);
    } catch {
      header = { raw: 'ERROR', mapped: 'unknown' };
    }

    // Validate it's really a DWG
    if (!header.raw.startsWith('AC')) {
      process.stdout.write(`❌ Invalid DWG header: "${header.raw}"\n`);
      invalidSourcesRemoved++;
      continue;
    }

    process.stdout.write(`✅ DWG ${header.mapped} (${(stat.size / 1024).toFixed(1)} KB)\n`);

    rawEntries.push({
      _tempIdx: rawEntries.length,
      corpusId: '', // assigned after dedup
      sha256,
      originalFilename: filename,
      immutablePath: path.resolve(filePath),
      byteSize: stat.size,
      sizeDecile: 'D1', // assigned in pass 2
      sourcePageUrl: opts.defaultSourceUrl,
      sourceCategory: opts.categoryMap?.[filename] ?? 'unknown',
      dwgHeaderVersion: header.raw,
      dwgVersion: header.mapped,
      externalDependencyStatus: 'unknown',
      referencedExternalFiles: [],
      partition: 'development', // assigned in pass 2
      admittedAt: new Date().toISOString(),
    });
  }

  // Pass 2: Assign deciles, partitions, and stable IDs
  const deciles = assignSizeDeciles(rawEntries);
  rawEntries.forEach((e, i) => { e.sizeDecile = deciles[i]; });

  const entriesWithDeciles: CorpusManifestEntry[] = rawEntries.map(({ _tempIdx, ...rest }) => rest);
  const partitioned = assignPartitions(entriesWithDeciles);

  // Assign stable corpus IDs after partition sort
  const finalEntries: CorpusManifestEntry[] = partitioned.map((e, i) => ({
    ...e,
    corpusId: `CORP-${String(i + 1).padStart(4, '0')}`,
  }));

  // Build distribution maps
  const versionDist: Record<string, number> = {};
  const categoryDist: Partial<Record<SourceCategory, number>> = {};
  const partitionCounts = { development: 0, validation: 0, holdout: 0 };

  for (const e of finalEntries) {
    versionDist[e.dwgVersion] = (versionDist[e.dwgVersion] ?? 0) + 1;
    categoryDist[e.sourceCategory] = (categoryDist[e.sourceCategory] ?? 0) + 1;
    partitionCounts[e.partition]++;
  }

  const manifest: CorpusManifest = {
    schemaVersion: '1.0.0',
    generatedAt: new Date().toISOString(),
    totalDownloaded: files.length,
    duplicatesRemoved,
    uniqueValidCount: finalEntries.length,
    invalidSourcesRemoved,
    partitionCounts,
    versionDistribution: versionDist,
    categoryDistribution: categoryDist as Record<SourceCategory, number>,
    entries: finalEntries,
  };

  // Write to disk
  await fs.writeFile(opts.outputPath, JSON.stringify(manifest, null, 2), 'utf8');
  console.log(`\n✅ Manifest written to ${opts.outputPath}`);
  console.log(`   Total downloaded:      ${manifest.totalDownloaded}`);
  console.log(`   Duplicates removed:    ${manifest.duplicatesRemoved}`);
  console.log(`   Invalid sources:       ${manifest.invalidSourcesRemoved}`);
  console.log(`   ─────────────────────────────`);
  console.log(`   Valid unique corpus:   ${manifest.uniqueValidCount} files (the denominator)`);
  console.log(`   Development split:     ${partitionCounts.development}`);
  console.log(`   Validation split:      ${partitionCounts.validation}`);
  console.log(`   Holdout (SEALED):      ${partitionCounts.holdout} 🔒\n`);

  return manifest;
}
