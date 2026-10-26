import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { CircleAlert, CloudDownload, TriangleAlert, X } from 'lucide-react';
import type { Card } from '../types/card';
import type { CardStore } from '../utils/storage';
import { scryfall, ScryfallApiError } from '../scryfall/client';
import { DEFAULT_IMPORT_OPTIONS, type ImportOptions } from '../scryfall/filters';
import {
  buildPreview,
  fetchSetTarget,
  getSetList,
  importableSets,
  normalizeSetCode,
  type ImportTarget,
} from '../scryfall/importSet';
import type { SyncResult } from '../scryfall/merge';
import type { ScryfallSet } from '../scryfall/types';
import { Dialog } from './ui/Dialog';
import { Button, IconButton } from './ui/Button';
import { TabList, tabId, tabPanelId, type TabItem } from './ui/Tabs';
import { matchSets, SetCombobox } from './ScryfallSetCombobox';
import { ImportPreviewPanel } from './ScryfallImportPreview';
import { ImportedSetsList } from './ScryfallImportedSets';
import { ImportOptionsFields } from './ScryfallImportOptions';
import { BulkFileTab, type BulkResult } from './ScryfallBulkFileTab';

interface ScryfallImportDialogProps {
  cards: Card[];
  cache: Pick<CardStore, 'getCache' | 'setCache'>;
  onApply: (result: SyncResult, label: string) => void;
  onRemoveSet: (code: string) => void;
  onClose: () => void;
}

type FetchState =
  | { kind: 'idle' }
  | { kind: 'fetching'; fetched: number; total?: number }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; target: ImportTarget; opts: ImportOptions; importedAt: string };

const LABEL = 'block text-sm font-medium text-fg-soft mb-1.5';

type Tab = 'set' | 'bulk';
const TABS: readonly TabItem<Tab>[] = [
  { key: 'set', label: 'Scryfall set' },
  { key: 'bulk', label: 'Bulk file' },
];

const isAbort = (err: unknown) => (err as { name?: string } | null)?.name === 'AbortError';

function describeError(err: unknown): string {
  if (err instanceof ScryfallApiError) {
    return err.status === 429
      ? 'Scryfall is still asking us to slow down after 3 tries. Wait a minute, then fetch again.'
      : err.message;
  }
  // fetch() rejects with a TypeError when the network or CORS fails.
  if (err instanceof TypeError) return 'Couldn’t reach Scryfall. Check your connection, then fetch again.';
  return `Couldn’t fetch the set (${err instanceof Error ? err.name : 'unknown error'}). Try again in a moment.`;
}

export const ScryfallImportDialog: React.FC<ScryfallImportDialogProps> = ({ cards, cache, onApply, onRemoveSet, onClose }) => {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const fetchRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const previewRef = useRef<HTMLHeadingElement>(null);
  const bulkPreviewRef = useRef<HTMLHeadingElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [tab, setTab] = useState<Tab>('set');
  const [bulk, setBulk] = useState<BulkResult | null>(null);

  const [sets, setSets] = useState<ScryfallSet[] | null>(null);
  const [setsFailed, setSetsFailed] = useState(false);
  const setsRequest = useRef<Promise<ScryfallSet[]>>(Promise.resolve([]));
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<ScryfallSet | null>(null);
  const [codeMissing, setCodeMissing] = useState(false);
  const [options, setOptions] = useState<ImportOptions>(DEFAULT_IMPORT_OPTIONS);
  const [state, setState] = useState<FetchState>({ kind: 'idle' });
  const [pause, setPause] = useState<{ resumeAt: number; seconds: number } | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const importable = useMemo(() => (sets ? importableSets(sets) : null), [sets]);
  // Derived from the current cards, so the counts and the result always match the database.
  const preview = useMemo(
    () => (state.kind === 'ready' ? buildPreview([state.target], state.opts, cards, state.importedAt) : null),
    [state, cards]
  );
  const bulkPreview = useMemo(
    () => (bulk ? buildPreview(bulk.targets, bulk.opts, cards, bulk.importedAt) : null),
    [bulk, cards]
  );
  const activePreview = tab === 'set' ? preview : bulkPreview;

  // The set list: cached for 24 h, else one /sets request.
  useEffect(() => {
    const controller = new AbortController();
    const request = getSetList(scryfall, cache, controller.signal);
    setsRequest.current = request.catch(() => []);
    request.then(setSets, (err: unknown) => {
      if (isAbort(err)) return;
      console.warn('Could not load the Scryfall set list', err);
      setSetsFailed(true);
      setSets([]);
    });
    return () => controller.abort();
  }, [cache]);

  // Closing the dialog cancels an import in progress; nothing is merged.
  useEffect(() => () => abortRef.current?.abort(), []);

  useEffect(() => {
    scryfall.setStatusListener(s =>
      setPause(s.kind === 'rate-limited' ? { resumeAt: s.resumeAt, seconds: Math.ceil((s.resumeAt - Date.now()) / 1000) } : null)
    );
    return () => scryfall.setStatusListener(undefined);
  }, []);

  // The countdown ends at resumeAt even when no further status arrives (the client gave up).
  useEffect(() => {
    if (!pause) return;
    setNow(Date.now());
    const timer = window.setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= pause.resumeAt) setPause(null);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [pause]);
  const secondsLeft = pause ? Math.max(0, Math.ceil((pause.resumeAt - now) / 1000)) : 0;

  // The set field is where every import starts. (Runs after Dialog's showModal, which focuses the first control.)
  useEffect(() => inputRef.current?.focus(), []);

  // Fetching disables the form, so focus moves to Cancel, then on to whatever the fetch ended with.
  const prevKind = useRef(state.kind);
  useEffect(() => {
    const prev = prevKind.current;
    prevKind.current = state.kind;
    if (state.kind === 'fetching') cancelRef.current?.focus();
    else if (prev === 'fetching') {
      if (state.kind === 'ready') previewRef.current?.focus();
      else if (state.kind === 'error') inputRef.current?.focus();
      else fetchRef.current?.focus();
    }
  }, [state.kind]);

  // A finished bulk read moves focus to its preview, like a finished fetch.
  useEffect(() => {
    if (bulk) bulkPreviewRef.current?.focus();
  }, [bulk]);

  const busy = state.kind === 'fetching';
  // A new set or new options make the preview stale.
  const invalidate = () => setState(s => (s.kind === 'ready' || s.kind === 'error' ? { kind: 'idle' } : s));

  const codeToFetch = (): string => {
    if (picked) return picked.code;
    const q = normalizeSetCode(query);
    return sets?.find(s => s.name.toLowerCase() === q)?.code ?? q;
  };

  const handleFetch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const code = codeToFetch();
    if (!code) {
      setCodeMissing(true);
      inputRef.current?.focus();
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    const opts = options;
    setState({ kind: 'fetching', fetched: 0 });
    try {
      // The token set is found through the set list, so wait for it if it's still loading.
      const list = sets ?? (await setsRequest.current);
      const target = await fetchSetTarget(code, opts, {
        client: scryfall,
        sets: list,
        signal: controller.signal,
        onProgress: (fetched, total) => {
          if (!controller.signal.aborted) setState({ kind: 'fetching', fetched, total });
        },
      });
      if (!controller.signal.aborted) setState({ kind: 'ready', target, opts, importedAt: new Date().toISOString() });
    } catch (err) {
      // Cancel already reset the state; a cancelled import shows no error.
      if (!controller.signal.aborted && !isAbort(err)) setState({ kind: 'error', message: describeError(err) });
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
    }
  };

  const handleCancel = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setState({ kind: 'idle' });
  };

  const handleApply = () => {
    if (!activePreview) return;
    const { targets } = activePreview;
    onApply(activePreview.sync, targets.length === 1 ? targets[0].name : `${targets.length} sets`);
    onClose();
  };

  // The Undo toast sits behind a modal dialog, so the dialog closes to make it reachable.
  const handleRemove = (code: string) => {
    onRemoveSet(code);
    onClose();
  };

  const typed = query.trim();
  const hint =
    sets === null
      ? 'Loading the set list…'
      : setsFailed
        ? 'Couldn’t load the set list. You can still type a set code, such as NEO.'
        : typed && !picked && importable && matchSets(importable, typed).length === 0
          ? `No listed set matches. Fetch cards looks up “${typed}” as a set code.`
          : 'Search by name or code. Any Scryfall set code works, even if it isn’t listed.';

  const n = activePreview?.incoming.length ?? 0;

  // A fixed height keeps the tabs still: a centred dialog that resized with its content would move
  // them when switching tabs, or between mousedown and mouseup when the set list collapses on blur.
  return (
    <Dialog labelledBy={`${id}-title`} onClose={onClose} className="sm:w-[min(100%-2rem,40rem)] h-[min(100dvh-2rem,48rem)]">
      <div className="flex h-full max-h-[inherit] flex-col">
        <div className="flex items-center justify-between gap-3 border-b border-line px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="grid place-items-center size-10 rounded-xl border border-accent-line/60 bg-accent-soft text-accent-fg" aria-hidden>
              <CloudDownload className="size-5" />
            </div>
            <div>
              <h2 id={`${id}-title`} className="text-section text-fg-strong">
                Import from Scryfall
              </h2>
              <p className="text-sm text-fg-muted">Fetch a Magic set or read sets from a bulk file, and check them before anything is saved.</p>
            </div>
          </div>
          <IconButton label="Close" variant="ghost" onClick={onClose}>
            <X aria-hidden className="size-5" />
          </IconButton>
        </div>

        <div className="px-6 pt-4">
          <TabList label="Import from" idPrefix={id} tabs={TABS} selected={tab} onSelect={setTab} />
        </div>

        <div className="flex-1 overflow-y-auto px-6 pt-4 pb-5 space-y-5">
          <div role="tabpanel" id={tabPanelId(id, 'set')} aria-labelledby={tabId(id, 'set')} hidden={tab !== 'set'} className="space-y-5">
            <form onSubmit={handleFetch} noValidate>
              <fieldset disabled={busy} className="min-w-0 space-y-4">
                <legend className="sr-only">Set and options</legend>
                <div>
                  <label id={`${id}-set-label`} htmlFor={`${id}-set`} className={LABEL}>
                    Set
                  </label>
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <SetCombobox
                        ref={inputRef}
                        id={`${id}-set`}
                        labelId={`${id}-set-label`}
                        sets={importable}
                        value={query}
                        onChange={v => {
                          setQuery(v);
                          setPicked(null);
                          setCodeMissing(false);
                          invalidate();
                        }}
                        onPick={set => {
                          setQuery(set.name);
                          setPicked(set);
                          setCodeMissing(false);
                          invalidate();
                        }}
                        disabled={busy}
                        invalid={codeMissing}
                        describedBy={codeMissing ? `${id}-set-error ${id}-set-hint` : `${id}-set-hint`}
                      />
                    </div>
                    <Button ref={fetchRef} type="submit" size="md">
                      Fetch cards
                    </Button>
                  </div>
                  {codeMissing && (
                    <p id={`${id}-set-error`} className="mt-1.5 text-sm text-danger">
                      Pick a set or type a set code.
                    </p>
                  )}
                  <p id={`${id}-set-hint`} className="mt-1.5 text-xs text-fg-muted">
                    {hint}
                  </p>
                </div>

                <ImportOptionsFields
                  value={options}
                  onChange={next => {
                    setOptions(next);
                    invalidate();
                  }}
                />
              </fieldset>
            </form>

            {state.kind === 'fetching' && (
              <div className="space-y-3 rounded-xl border border-accent-line/50 bg-well p-4">
                <div className="flex items-center justify-between gap-3">
                  <p role="status" className="text-sm text-accent-fg">
                    {state.total === undefined ? 'Fetching cards…' : `Fetched ${state.fetched} of ${state.total} cards`}
                  </p>
                  <Button ref={cancelRef} onClick={handleCancel}>
                    Cancel
                  </Button>
                </div>
                {state.total !== undefined && (
                  <div
                    role="progressbar"
                    aria-label="Cards fetched"
                    aria-valuemin={0}
                    aria-valuemax={state.total}
                    aria-valuenow={state.fetched}
                    className="h-2 w-full overflow-hidden rounded-full bg-raised"
                  >
                    <div
                      className="h-full origin-left bg-accent transition-transform duration-300 ease-out-expo motion-reduce:transition-none"
                      style={{ transform: `scaleX(${state.total ? state.fetched / state.total : 0})` }}
                    />
                  </div>
                )}
                {secondsLeft > 0 && (
                  <p aria-hidden className="flex items-start gap-2 text-sm text-fg-soft">
                    <TriangleAlert className="size-4 shrink-0 mt-0.5 text-warning" />
                    Scryfall asked us to slow down, resuming in {secondsLeft} s
                  </p>
                )}
                {/* Announced once; the visible countdown above ticks silently. */}
                <p aria-live="polite" className="sr-only">
                  {pause && secondsLeft > 0 ? `Scryfall asked us to slow down, resuming in ${pause.seconds} seconds.` : ''}
                </p>
              </div>
            )}

            {state.kind === 'error' && (
              <p role="alert" className="flex items-start gap-2 rounded-xl border border-rose-800 bg-danger-soft p-3 text-sm text-rose-100">
                <CircleAlert aria-hidden className="size-4 shrink-0 mt-0.5 text-danger" />
                {state.message}
              </p>
            )}

            {preview && <ImportPreviewPanel preview={preview} headingRef={previewRef} />}
          </div>

          <div role="tabpanel" id={tabPanelId(id, 'bulk')} aria-labelledby={tabId(id, 'bulk')} hidden={tab !== 'bulk'} className="space-y-5">
            <BulkFileTab knownSets={sets ?? undefined} onResult={setBulk} />
            {bulkPreview && <ImportPreviewPanel preview={bulkPreview} headingRef={bulkPreviewRef} />}
          </div>

          <ImportedSetsList cards={cards} sets={sets} onRemove={handleRemove} />
        </div>

        <div className="flex justify-end gap-2 border-t border-line px-6 py-4">
          <Button variant="ghost" size="md" onClick={onClose}>
            Close
          </Button>
          {activePreview && n > 0 && (
            <Button variant="primary" size="md" onClick={handleApply}>
              Add {n} {n === 1 ? 'card' : 'cards'}
            </Button>
          )}
        </div>
      </div>
    </Dialog>
  );
};
