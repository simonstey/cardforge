import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { CircleAlert } from 'lucide-react';
import type { BulkRequest, BulkResponse } from '../scryfall/bulkJob';
import { bulkSetOptions, bulkTargets, collectCodes } from '../scryfall/bulkSets';
import type { BulkSetSummary } from '../scryfall/bulkStream';
import { DEFAULT_IMPORT_OPTIONS, type ImportOptions } from '../scryfall/filters';
import type { ImportTarget } from '../scryfall/importSet';
import type { ScryfallSet } from '../scryfall/types';
import { Button } from './ui/Button';
import { ImportOptionsFields } from './ScryfallImportOptions';
import { BulkSetPicker } from './ScryfallBulkSetPicker';

/** What a finished collect pass hands the dialog, which builds the preview from it. */
export interface BulkResult {
  targets: ImportTarget[];
  opts: ImportOptions;
  importedAt: string;
}

interface BulkFileTabProps {
  /** The `/sets` list, for matching token sets to their parents; undefined while it loads or offline. */
  knownSets?: ScryfallSet[];
  /** A finished collect pass, or null once a new file, set choice or option makes it stale. */
  onResult: (result: BulkResult | null) => void;
}

interface Scan {
  file: File;
  sets: BulkSetSummary[];
  malformed: number;
}

type Pass = Exclude<BulkRequest, { type: 'cancel' }>;
type Job = { kind: Pass['type']; message: string; read: number; total: number };
type Finished = Exclude<BulkResponse, { type: 'progress' }>;

const LABEL = 'block text-sm font-medium text-fg-soft mb-1.5';
const FILE_INPUT =
  'block w-full text-sm text-fg-muted cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ' +
  'file:mr-3 file:min-h-10 pointer-coarse:file:min-h-11 file:cursor-pointer file:rounded-xl file:border file:border-line-strong ' +
  'file:bg-raised file:px-4 file:text-sm file:font-semibold file:text-fg file:transition-colors file:duration-150 ' +
  'hover:file:bg-raised-hover hover:file:text-fg-strong';

const MB = 1_048_576;
const megabytes = (bytes: number) => (bytes / MB).toFixed(1);
const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`;
const unreadable = (file: File) => `Couldn’t read ${file.name}. Choose a Scryfall bulk file, such as Default Cards (.jsonl.gz).`;

// How long a cancelled pass gets to stop before its worker is terminated anyway.
const CANCEL_GRACE_MS = 2000;

/**
 * Terminates a worker whose pass is still running. Terminating one mid-read can crash Chromium's
 * renderer (reproduced with Default Cards as plain JSONL), so the pass is cancelled first, which stops
 * the file read, and the worker is terminated once it answers.
 */
function cancelAndTerminate(worker: Worker) {
  const timer = window.setTimeout(() => worker.terminate(), CANCEL_GRACE_MS);
  const end = () => {
    window.clearTimeout(timer);
    worker.terminate();
  };
  worker.onmessage = (e: MessageEvent<BulkResponse>) => {
    if (e.data.type !== 'progress') end();
  };
  worker.onerror = end;
  worker.postMessage({ type: 'cancel' } satisfies BulkRequest);
}

/**
 * Dialog tab 2 (spec 6.12): pick a Scryfall bulk file, scan it for sets, then read the chosen sets'
 * cards. Both passes run in a module worker; Cancel and unmounting stop the pass and terminate it.
 */
export const BulkFileTab: React.FC<BulkFileTabProps> = ({ knownSets, onResult }) => {
  const id = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const filterRef = useRef<HTMLInputElement>(null);
  const readRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const workerRef = useRef<Worker | null>(null);
  // Where focus goes when a pass ends; a finished collect leaves it to the dialog's preview.
  const focusAfter = useRef<React.RefObject<HTMLElement | null> | null>(null);

  const [scan, setScan] = useState<Scan | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set());
  const [selectionMissing, setSelectionMissing] = useState(false);
  const [options, setOptions] = useState<ImportOptions>(DEFAULT_IMPORT_OPTIONS);

  const sets = useMemo(() => (scan ? bulkSetOptions(scan.sets, knownSets) : []), [scan, knownSets]);
  // A set can fold into its parent once the set list arrives, so pick from what's listed, not `selected`.
  const chosen = sets.filter(s => selected.has(s.code));
  const busy = job !== null;

  // Only a running pass holds a worker: a finished one terminates it straight away.
  const cancelWorker = () => {
    const worker = workerRef.current;
    workerRef.current = null;
    if (worker) cancelAndTerminate(worker);
  };

  useEffect(
    () => () => {
      if (workerRef.current) cancelAndTerminate(workerRef.current);
    },
    []
  );

  useEffect(() => {
    if (busy) {
      cancelRef.current?.focus();
      return;
    }
    focusAfter.current?.current?.focus();
    focusAfter.current = null;
  }, [busy]);

  const runWorker = (request: Pass, message: string, onDone: (result: Finished) => void) => {
    cancelWorker();
    const worker = new Worker(new URL('../scryfall/bulkWorker.ts', import.meta.url), { type: 'module' });
    workerRef.current = worker;
    const kind = request.type;
    setJob({ kind, message, read: 0, total: request.file.size });
    const finish = (result: Finished) => {
      if (workerRef.current !== worker) return;
      workerRef.current = null;
      worker.terminate();
      setJob(null);
      if (result.type === 'error') console.warn(`The bulk file ${kind} failed:`, result.message);
      onDone(result);
    };
    worker.onmessage = (e: MessageEvent<BulkResponse>) => {
      const m = e.data;
      if (m.type !== 'progress') finish(m);
      else if (workerRef.current === worker) setJob({ kind, message, read: m.read, total: m.total });
    };
    // The worker failed to load, or threw outside the job.
    worker.onerror = e => {
      e.preventDefault();
      finish({ type: 'error', message: e.message || 'The bulk file worker failed.' });
    };
    worker.postMessage(request);
  };

  const clearFileInput = () => {
    // Lets the same file be chosen again after a failed or cancelled scan.
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // A new file makes the old sets, choice and preview meaningless.
    setScan(null);
    setSelected(new Set());
    setQuery('');
    setError(null);
    setSelectionMissing(false);
    onResult(null);
    if (!file) return;
    runWorker({ type: 'scan', file }, `Finding the sets in ${file.name}…`, result => {
      if (result.type === 'scanned' && result.sets.length > 0) {
        setScan({ file, sets: result.sets, malformed: result.malformed });
        focusAfter.current = filterRef;
        return;
      }
      setError(
        result.type === 'scanned'
          ? `${file.name} has no Scryfall cards in it. Choose a bulk file, such as Default Cards (.jsonl.gz).`
          : unreadable(file)
      );
      clearFileInput();
      focusAfter.current = fileRef;
    });
  };

  const handleRead = () => {
    if (!scan || busy) return;
    if (chosen.length === 0) {
      setSelectionMissing(true);
      filterRef.current?.focus();
      return;
    }
    const picked = chosen;
    const opts = options;
    setError(null);
    onResult(null);
    runWorker(
      { type: 'collect', file: scan.file, codes: collectCodes(picked, opts.includeTokens) },
      `Reading ${plural(picked.length, 'set')} from ${scan.file.name}…`,
      result => {
        if (result.type === 'collected') {
          onResult({ targets: bulkTargets(picked, result.cards, opts.includeTokens), opts, importedAt: new Date().toISOString() });
          return;
        }
        setError(unreadable(scan.file));
        focusAfter.current = readRef;
      }
    );
  };

  const handleCancel = () => {
    const kind = job?.kind;
    cancelWorker();
    if (kind === 'scan') {
      clearFileInput();
      focusAfter.current = fileRef;
    } else {
      focusAfter.current = readRef;
    }
    setJob(null);
  };

  const toggle = (code: string, on: boolean) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (on) next.add(code);
      else next.delete(code);
      return next;
    });
    setSelectionMissing(false);
    onResult(null);
  };

  return (
    <div className="space-y-5">
      <fieldset disabled={busy} className="min-w-0 space-y-4">
        <legend className="sr-only">Bulk file, sets and options</legend>
        <div>
          <label htmlFor={`${id}-file`} className={LABEL}>
            Bulk file
          </label>
          <input
            ref={fileRef}
            id={`${id}-file`}
            type="file"
            accept=".gz,.jsonl,.json"
            onChange={handleFile}
            aria-describedby={`${id}-file-hint`}
            className={FILE_INPUT}
          />
          <p id={`${id}-file-hint`} className="mt-1.5 text-xs text-fg-muted">
            Download Default Cards from{' '}
            <a
              href="https://scryfall.com/docs/api/bulk-data"
              target="_blank"
              rel="noreferrer"
              className="text-accent-fg underline underline-offset-2 hover:text-fg-strong"
            >
              Scryfall’s bulk data page
            </a>{' '}
            (about 76 MB), then choose it here. The file is read on your device and never uploaded.
          </p>
        </div>

        {scan && (
          <>
            <BulkSetPicker
              ref={filterRef}
              sets={sets}
              selected={selected}
              onToggle={toggle}
              query={query}
              onQueryChange={setQuery}
              fileName={scan.file.name}
              malformed={scan.malformed}
              missing={selectionMissing}
            />

            <ImportOptionsFields
              value={options}
              onChange={next => {
                setOptions(next);
                onResult(null);
              }}
            />

            <div className="flex justify-end">
              <Button ref={readRef} size="md" onClick={handleRead}>
                Read cards
              </Button>
            </div>
          </>
        )}
      </fieldset>

      {job && (
        <div className="space-y-3 rounded-xl border border-accent-line/50 bg-well p-4">
          <div className="flex items-center justify-between gap-3">
            <p role="status" className="min-w-0 text-sm text-accent-fg break-words">
              {job.message}
            </p>
            <Button ref={cancelRef} onClick={handleCancel}>
              Cancel
            </Button>
          </div>
          <div
            role="progressbar"
            aria-label="File read"
            aria-valuemin={0}
            aria-valuemax={job.total}
            aria-valuenow={job.read}
            aria-valuetext={`${megabytes(job.read)} of ${megabytes(job.total)} MB`}
            className="h-2 w-full overflow-hidden rounded-full bg-raised"
          >
            <div
              className="h-full origin-left bg-accent transition-transform duration-300 ease-out-expo motion-reduce:transition-none"
              style={{ transform: `scaleX(${job.total ? job.read / job.total : 0})` }}
            />
          </div>
          <p aria-hidden className="text-xs text-fg-muted">
            {megabytes(job.read)} of {megabytes(job.total)} MB
          </p>
        </div>
      )}

      {error && (
        <p role="alert" className="flex items-start gap-2 rounded-xl border border-rose-800 bg-danger-soft p-3 text-sm text-rose-100">
          <CircleAlert aria-hidden className="size-4 shrink-0 mt-0.5 text-danger" />
          {error}
        </p>
      )}
    </div>
  );
};
