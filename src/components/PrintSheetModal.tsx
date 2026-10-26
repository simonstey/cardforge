import React, { useId, useMemo, useState } from 'react';
import { BoosterPack, Card } from '../types/card';
import { generatePrintPdf, PdfExportOptions } from '../utils/pdfGenerator';
import { getCardArt } from '../utils/cardArt';
import { playClickSound } from '../utils/audioFeedback';
import { Dialog } from './ui/Dialog';
import { Button, IconButton, ToggleChip } from './ui/Button';
import { cx } from './ui/cx';
import { Printer, Download, FileText, ChevronLeft, ChevronRight, X, CircleAlert } from 'lucide-react';

interface PrintSheetModalProps {
  packs: BoosterPack[];
  onClose: () => void;
}

interface Slot {
  card: Card;
  packNumber: number;
  indexInPack: number;
}

const OPTION_ROW =
  'flex items-start gap-3 rounded-xl border border-line bg-well/60 p-3 min-h-11 cursor-pointer hover:border-line-strong transition-colors duration-150';

export const PrintSheetModal: React.FC<PrintSheetModalProps> = ({ packs, onClose }) => {
  const id = useId();
  const [paperSize, setPaperSize] = useState<'letter' | 'a4'>('letter');
  const [faceStyle, setFaceStyle] = useState<'scan' | 'layout'>('scan');
  const [includeCutMarks, setIncludeCutMarks] = useState(true);
  const [includeBacks, setIncludeBacks] = useState(false);
  const [includePackHeaders, setIncludePackHeaders] = useState(true);
  const [newSheetPerPack, setNewSheetPerPack] = useState(false);
  const [customBackText, setCustomBackText] = useState('STAR WARS TCG');
  const [previewSheetIndex, setPreviewSheetIndex] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState({ percent: 0, status: '' });
  const [error, setError] = useState<string | null>(null);

  // Lay out sheet slots exactly as the PDF will (empty slots when each pack starts a new sheet).
  const slots = useMemo(() => {
    const out: (Slot | null)[] = [];
    packs.forEach(pack => {
      if (newSheetPerPack) while (out.length % 9 !== 0) out.push(null);
      pack.cards.forEach((card, idx) => out.push({ card, packNumber: pack.packNumber, indexInPack: idx }));
    });
    return out;
  }, [packs, newSheetPerPack]);

  const totalCards = packs.reduce((n, p) => n + p.cards.length, 0);
  const totalSheets = Math.max(1, Math.ceil(slots.length / 9));
  const sheetIndex = Math.min(previewSheetIndex, totalSheets - 1);
  const sheetSlots = Array.from({ length: 9 }, (_, i) => slots[sheetIndex * 9 + i] ?? null);

  const handleGeneratePdf = async () => {
    playClickSound();
    setError(null);
    setIsExporting(true);
    setProgress({ percent: 0, status: 'Preparing…' });
    try {
      const options: PdfExportOptions = {
        paperSize,
        orientation: 'portrait',
        includeCutMarks,
        includeBacks,
        includePackHeaders,
        cardsPerSheet: 9,
        bleedMm: 0,
        customBackText: customBackText.trim() || 'STAR WARS TCG',
        faceStyle,
        newSheetPerPack,
      };
      const pdfBlob = await generatePrintPdf(packs, options, (percent, status) => setProgress({ percent, status }));
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `CardForge_Print_Sheets_${packs.length}_Packs_${paperSize.toUpperCase()}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      setProgress({ percent: 100, status: 'PDF downloaded.' });
    } catch (err) {
      console.error('PDF generation failed:', err);
      setError('The PDF couldn’t be generated. Try fewer packs or switch to the generated layout, then try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportManifest = () => {
    playClickSound();
    let manifest = `CARDFORGE BOOSTER PACK MANIFEST\nTotal Packs: ${packs.length}\nTotal Cards: ${totalCards}\nGenerated: ${new Date().toLocaleString()}\n\n`;

    packs.forEach(pack => {
      const foils = new Set(pack.foilCardIds ?? []);
      manifest += `========================================\nPACK #${pack.packNumber}${pack.hasMythic ? ' [MYTHIC PACK]' : ''}\n========================================\n`;
      pack.cards.forEach((c, idx) => {
        manifest += `${idx + 1}. [${c.rarity}] ${c.name} (${c.type})${c.cost ? ` ${c.cost}` : ''}${foils.has(c.id) ? ' [FOIL]' : ''}\n`;
      });
      manifest += '\n';
    });

    const blob = new Blob([manifest], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `booster_packs_manifest_${packs.length}_packs.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const printedSheets = includeBacks ? totalSheets * 2 : totalSheets;

  return (
    <Dialog labelledBy={`${id}-title`} onClose={onClose} className="sm:w-[min(100%-2rem,58rem)]">
      <div className="flex max-h-[inherit] flex-col">
        <div className="flex items-center justify-between gap-3 border-b border-line px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="grid place-items-center size-10 rounded-xl border border-accent-line/60 bg-accent-soft text-accent-fg" aria-hidden>
              <Printer className="size-5" />
            </div>
            <div>
              <h2 id={`${id}-title`} className="text-section text-fg-strong">
                Print sheets
              </h2>
              <p className="text-sm text-fg-muted">3 × 3 sheets of 63 × 88 mm cards, with cut guides</p>
            </div>
          </div>
          <IconButton label="Close" variant="ghost" onClick={onClose}>
            <X aria-hidden className="size-5" />
          </IconButton>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
            {/* Sheet preview */}
            <div className="space-y-3">
              <dl className="grid grid-cols-3 gap-2">
                <div className="rounded-xl border border-line bg-well/70 px-3 py-2">
                  <dt className="text-xs text-fg-muted">Cards</dt>
                  <dd className="text-xl font-bold proportional-nums text-fg-strong">{totalCards}</dd>
                </div>
                <div className="rounded-xl border border-line bg-well/70 px-3 py-2">
                  <dt className="text-xs text-fg-muted">Sheets to print</dt>
                  <dd className="text-xl font-bold proportional-nums text-fg-strong">
                    {printedSheets}
                    {includeBacks && <span className="ml-1 text-xs font-normal text-fg-muted">fronts + backs</span>}
                  </dd>
                </div>
                <div className="rounded-xl border border-line bg-well/70 px-3 py-2">
                  <dt className="text-xs text-fg-muted">Card size</dt>
                  <dd className="text-sm font-semibold text-fg-strong leading-7">63 × 88 mm</dd>
                </div>
              </dl>

              <div className="rounded-2xl border border-line bg-well p-3">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <h3 className="text-group uppercase text-fg-soft">Sheet preview</h3>
                  <div className="flex items-center gap-1">
                    <IconButton
                      label="Previous sheet"
                      variant="ghost"
                      onClick={() => setPreviewSheetIndex(Math.max(0, sheetIndex - 1))}
                      disabled={sheetIndex === 0}
                    >
                      <ChevronLeft aria-hidden className="size-4" />
                    </IconButton>
                    <span className="min-w-16 text-center text-sm text-fg-soft" aria-live="polite">
                      {sheetIndex + 1} of {totalSheets}
                    </span>
                    <IconButton
                      label="Next sheet"
                      variant="ghost"
                      onClick={() => setPreviewSheetIndex(Math.min(totalSheets - 1, sheetIndex + 1))}
                      disabled={sheetIndex === totalSheets - 1}
                    >
                      <ChevronRight aria-hidden className="size-4" />
                    </IconButton>
                  </div>
                </div>

                {/* Paper, scaled: the 3 × 3 grid is centered with margins like the PDF */}
                <div
                  className={cx(
                    'relative mx-auto w-full max-w-sm rounded-sm bg-stone-100 shadow-lg shadow-black/50',
                    paperSize === 'a4' ? 'aspect-[210/297]' : 'aspect-[215.9/279.4]'
                  )}
                >
                  <div className="absolute inset-0 grid place-items-center">
                    <ul
                      className="grid grid-cols-3"
                      style={{ width: `${(189 / (paperSize === 'a4' ? 210 : 215.9)) * 100}%` }}
                      aria-label={`Sheet ${sheetIndex + 1} contents`}
                    >
                      {sheetSlots.map((slot, i) => {
                        const art = slot ? getCardArt(slot.card, slot.packNumber * 31 + slot.indexInPack) : null;
                        const src = faceStyle === 'scan' && art?.fullSrc ? art.fullSrc : null;
                        return (
                          <li
                            key={i}
                            className={cx(
                              'relative aspect-[63/88] overflow-hidden',
                              includeCutMarks ? 'outline outline-1 -outline-offset-1 outline-stone-400/70' : '',
                              !slot && 'bg-stone-200/60'
                            )}
                          >
                            {slot &&
                              (src ? (
                                <img src={src} alt={slot.card.name} crossOrigin="anonymous" loading="lazy" className="size-full object-cover" />
                              ) : (
                                <div aria-hidden className="flex size-full flex-col bg-white p-[6%] text-stone-900">
                                  <span className="truncate text-[0.5rem] font-bold leading-tight">{slot.card.name}</span>
                                  <span className="mt-[4%] block aspect-[55/28] w-full overflow-hidden bg-stone-300">
                                    {art && (
                                      <img
                                        src={art.src}
                                        alt=""
                                        crossOrigin="anonymous"
                                        loading="lazy"
                                        className={cx('size-full', art.srcIsFull ? 'object-contain' : 'object-cover')}
                                      />
                                    )}
                                  </span>
                                  <span className="mt-auto truncate text-[0.45rem] text-stone-600">#{slot.packNumber}</span>
                                </div>
                              ))}
                            {slot && !src && <span className="sr-only">{slot.card.name}</span>}
                            {!slot && <span className="sr-only">Empty slot</span>}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </div>
                <p className="mt-3 text-center text-xs text-fg-muted">
                  300–350 gsm card stock trims cleanly with a rotary cutter.
                </p>
              </div>
            </div>

            {/* Options */}
            <div className="space-y-4">
              <fieldset>
                <legend className="text-group uppercase text-fg-soft mb-2">Card faces</legend>
                <div className="space-y-2">
                  <label className={OPTION_ROW}>
                    <input
                      type="radio"
                      name={`${id}-face`}
                      checked={faceStyle === 'scan'}
                      onChange={() => setFaceStyle('scan')}
                      className="mt-0.5 size-4 shrink-0"
                    />
                    <span>
                      <span className="block text-sm font-semibold text-fg">Original card scans</span>
                      <span className="block text-xs text-fg-muted">The real printed card. Custom cards use the generated layout.</span>
                    </span>
                  </label>
                  <label className={OPTION_ROW}>
                    <input
                      type="radio"
                      name={`${id}-face`}
                      checked={faceStyle === 'layout'}
                      onChange={() => setFaceStyle('layout')}
                      className="mt-0.5 size-4 shrink-0"
                    />
                    <span>
                      <span className="block text-sm font-semibold text-fg">Generated layout</span>
                      <span className="block text-xs text-fg-muted">A plain, ink-light card face with the artwork and full text.</span>
                    </span>
                  </label>
                </div>
              </fieldset>

              <div>
                <span id={`${id}-paper`} className="block text-group uppercase text-fg-soft mb-2">
                  Paper
                </span>
                <div role="group" aria-labelledby={`${id}-paper`} className="grid grid-cols-2 gap-1.5">
                  <ToggleChip selected={paperSize === 'letter'} onClick={() => setPaperSize('letter')}>
                    US Letter
                  </ToggleChip>
                  <ToggleChip selected={paperSize === 'a4'} onClick={() => setPaperSize('a4')}>
                    A4
                  </ToggleChip>
                </div>
              </div>

              <fieldset className="space-y-2">
                <legend className="text-group uppercase text-fg-soft mb-2">Sheet options</legend>
                <label className={OPTION_ROW}>
                  <input
                    type="checkbox"
                    checked={includeCutMarks}
                    onChange={e => setIncludeCutMarks(e.target.checked)}
                    className="mt-0.5 size-4 shrink-0"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-fg">Cut guides</span>
                    <span className="block text-xs text-fg-muted">Margin ticks and crosshairs for a rotary trimmer</span>
                  </span>
                </label>
                <label className={OPTION_ROW}>
                  <input
                    type="checkbox"
                    checked={includePackHeaders}
                    onChange={e => setIncludePackHeaders(e.target.checked)}
                    className="mt-0.5 size-4 shrink-0"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-fg">Pack labels</span>
                    <span className="block text-xs text-fg-muted">Prints the pack numbers in the top margin</span>
                  </span>
                </label>
                <label className={OPTION_ROW}>
                  <input
                    type="checkbox"
                    checked={newSheetPerPack}
                    onChange={e => setNewSheetPerPack(e.target.checked)}
                    className="mt-0.5 size-4 shrink-0"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-fg">Start each pack on a new sheet</span>
                    <span className="block text-xs text-fg-muted">Keeps packs apart after cutting; uses more paper</span>
                  </span>
                </label>
                <label className={OPTION_ROW}>
                  <input
                    type="checkbox"
                    checked={includeBacks}
                    onChange={e => setIncludeBacks(e.target.checked)}
                    className="mt-0.5 size-4 shrink-0"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-fg">Duplex back sheets</span>
                    <span className="block text-xs text-fg-muted">A mirrored back after every sheet, for two-sided printing</span>
                  </span>
                </label>
                {includeBacks && (
                  <div className="pl-3">
                    <label htmlFor={`${id}-back`} className="block text-sm font-medium text-fg-soft mb-1.5">
                      Card back text
                    </label>
                    <input
                      id={`${id}-back`}
                      type="text"
                      maxLength={24}
                      value={customBackText}
                      onChange={e => setCustomBackText(e.target.value)}
                      className="w-full rounded-lg border border-line-strong bg-well px-3 min-h-10 text-sm text-fg hover:border-slate-600 focus-visible:border-accent"
                    />
                  </div>
                )}
              </fieldset>
            </div>
          </div>

          {(isExporting || progress.percent === 100) && (
            <div className="mt-5 rounded-xl border border-accent-line/50 bg-well p-4">
              <div className="flex justify-between text-sm text-accent-fg mb-2" aria-live="polite">
                <span>{progress.status}</span>
                <span>{progress.percent}%</span>
              </div>
              <div
                role="progressbar"
                aria-label="PDF progress"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progress.percent}
                className="h-2 w-full overflow-hidden rounded-full bg-raised"
              >
                <div
                  className="h-full origin-left bg-accent transition-transform duration-300 ease-out-expo"
                  style={{ transform: `scaleX(${progress.percent / 100})` }}
                />
              </div>
            </div>
          )}

          {error && (
            <p role="alert" className="mt-5 flex items-start gap-2 rounded-xl border border-rose-800 bg-danger-soft p-3 text-sm text-rose-100">
              <CircleAlert aria-hidden className="size-4 shrink-0 mt-0.5 text-danger" />
              {error}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-6 py-4">
          <Button onClick={handleExportManifest}>
            <FileText aria-hidden className="size-4" />
            Pack list (.txt)
          </Button>
          <div className="flex items-center gap-2 max-sm:w-full">
            <Button variant="ghost" size="md" onClick={onClose} className="max-sm:flex-1">
              Close
            </Button>
            <Button variant="primary" size="md" onClick={handleGeneratePdf} disabled={isExporting} className="max-sm:flex-1">
              <Download aria-hidden className="size-4" />
              {isExporting ? 'Generating PDF…' : 'Download PDF'}
            </Button>
          </div>
        </div>
      </div>
    </Dialog>
  );
};
