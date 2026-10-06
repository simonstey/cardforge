import React, { useState } from 'react';
import { BoosterPack } from '../types/card';
import { generatePrintPdf, PdfExportOptions } from '../utils/pdfGenerator';
import { CardItem } from './CardItem';
import { playClickSound } from '../utils/audioFeedback';
import {
  Printer,
  Download,
  FileText,
  Scissors,
  Copy,
  Eye,
  X,
  Layers,
  ChevronLeft,
  ChevronRight,
  Info,
} from 'lucide-react';

interface PrintSheetModalProps {
  packs: BoosterPack[];
  onClose: () => void;
}

export const PrintSheetModal: React.FC<PrintSheetModalProps> = ({ packs, onClose }) => {
  const [paperSize, setPaperSize] = useState<'letter' | 'a4'>('letter');
  const [includeCutMarks, setIncludeCutMarks] = useState<boolean>(true);
  const [includeBacks, setIncludeBacks] = useState<boolean>(false);
  const [includePackHeaders, setIncludePackHeaders] = useState<boolean>(true);
  const [customBackText, setCustomBackText] = useState<string>('STAR WARS TCG');
  const [previewSheetIndex, setPreviewSheetIndex] = useState<number>(0);
  const [showLivePreview, setShowLivePreview] = useState<boolean>(true);

  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [progress, setProgress] = useState<{ percent: number; status: string }>({ percent: 0, status: '' });

  // Flatten cards from all packs
  const allCards = packs.flatMap(p => p.cards);
  const totalSheets = Math.ceil(allCards.length / 9);
  const currentSheetCards = allCards.slice(previewSheetIndex * 9, (previewSheetIndex + 1) * 9);

  const handleGeneratePdf = async () => {
    try {
      playClickSound();
      setIsExporting(true);
      const options: PdfExportOptions = {
        paperSize,
        orientation: 'portrait',
        includeCutMarks,
        includeBacks,
        includePackHeaders,
        cardsPerSheet: 9,
        bleedMm: 0,
        customBackText,
      };

      const pdfBlob = await generatePrintPdf(packs, options, (pct, status) => {
        setProgress({ percent: pct, status });
      });

      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `CardForge_Print_Sheets_${packs.length}_Packs_${paperSize.toUpperCase()}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      console.error('PDF Generation failed:', err);
      alert('Failed to generate PDF. Please check console for details.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportManifest = () => {
    playClickSound();
    let manifest = `CARDFORGE BOOSTER PACK MANIFEST\nTotal Packs: ${packs.length}\nTotal Cards: ${allCards.length}\nGenerated: ${new Date().toLocaleString()}\n\n`;

    packs.forEach(pack => {
      manifest += `========================================\nPACK #${pack.packNumber} ${pack.hasMythic ? '[★ MYTHIC PACK]' : ''}\n========================================\n`;
      pack.cards.forEach((c, idx) => {
        manifest += `${idx + 1}. [${c.rarity}] ${c.name} (${c.type}) ${c.cost || ''}\n`;
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
    document.body.removeChild(a);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl text-slate-100 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-cyan-950/90 border border-cyan-800/80 text-cyan-400 flex items-center justify-center shadow-lg">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white font-heading">
                Physical Print Sheet Generator
              </h2>
              <p className="text-xs text-slate-400">
                Organized 3×3 grid (63×88mm MTG/poker standard) with cutting guides
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800">
              <span className="text-[11px] text-slate-400">Total Cards</span>
              <div className="text-xl font-black text-cyan-300 font-mono mt-0.5">{allCards.length}</div>
            </div>
            <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800">
              <span className="text-[11px] text-slate-400">Sheets to Print</span>
              <div className="text-xl font-black text-slate-200 font-mono mt-0.5">
                {includeBacks ? totalSheets * 2 : totalSheets}{' '}
                <span className="text-xs font-normal text-slate-400">
                  ({totalSheets} fronts {includeBacks && `+ ${totalSheets} backs`})
                </span>
              </div>
            </div>
            <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800">
              <span className="text-[11px] text-slate-400">Card Dimensions</span>
              <div className="text-xl font-black text-amber-300 font-mono mt-0.5">
                63 × 88 mm <span className="text-xs font-normal text-slate-400">(2.5 × 3.5")</span>
              </div>
            </div>
          </div>

          {/* Interactive Live 3x3 Sheet Visualizer */}
          <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-bold text-slate-200 uppercase tracking-wider font-mono">
                  Live Sheet Preview: Sheet #{previewSheetIndex + 1} of {totalSheets}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPreviewSheetIndex(prev => Math.max(0, prev - 1))}
                  disabled={previewSheetIndex === 0}
                  className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white disabled:opacity-40 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs font-mono text-slate-400 px-1">
                  {previewSheetIndex + 1} / {totalSheets}
                </span>
                <button
                  onClick={() => setPreviewSheetIndex(prev => Math.min(totalSheets - 1, prev + 1))}
                  disabled={previewSheetIndex === totalSheets - 1}
                  className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white disabled:opacity-40 transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* 3x3 Mock Preview with cut guides */}
            <div className="relative p-4 rounded-xl bg-slate-900/90 border border-dashed border-slate-700/80 max-w-xl mx-auto shadow-inner">
              {includeCutMarks && (
                <>
                  {/* Corner marks */}
                  <div className="absolute top-1 left-1 w-3 h-3 border-t-2 border-l-2 border-amber-400/70" />
                  <div className="absolute top-1 right-1 w-3 h-3 border-t-2 border-r-2 border-amber-400/70" />
                  <div className="absolute bottom-1 left-1 w-3 h-3 border-b-2 border-l-2 border-amber-400/70" />
                  <div className="absolute bottom-1 right-1 w-3 h-3 border-b-2 border-r-2 border-amber-400/70" />
                </>
              )}

              <div className="grid grid-cols-3 gap-2">
                {currentSheetCards.map((card, idx) => (
                  <div
                    key={`${card.id}-${idx}`}
                    className="h-24 rounded-md border border-slate-700 bg-slate-950 p-1 flex flex-col justify-between text-[9px] overflow-hidden"
                  >
                    <div className="font-bold text-slate-200 truncate leading-tight">
                      {card.name}
                    </div>
                    <div className="text-[8px] text-slate-400 truncate italic">
                      {card.type}
                    </div>
                    <div className="flex items-center justify-between text-[8px] border-t border-slate-800 pt-0.5">
                      <span className="font-mono text-cyan-400">[{card.rarity}]</span>
                      <span className="font-mono text-amber-300">{card.cost || '—'}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2 text-[11px] text-slate-400 justify-center">
              <Scissors className="w-3.5 h-3.5 text-cyan-400" />
              <span>Standard 300–350 gsm linen or smooth card stock recommended for trimming</span>
            </div>
          </div>

          {/* Options & Settings */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Paper standard */}
            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
              <div>
                <label className="text-xs font-bold text-slate-200">Paper Standard</label>
                <p className="text-[11px] text-slate-400">Select page size for your printer</p>
              </div>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setPaperSize('letter')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
                    paperSize === 'letter'
                      ? 'bg-cyan-950 text-cyan-300 border-cyan-500'
                      : 'bg-slate-900 text-slate-400 border-slate-800'
                  }`}
                >
                  US Letter (8.5×11")
                </button>
                <button
                  type="button"
                  onClick={() => setPaperSize('a4')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
                    paperSize === 'a4'
                      ? 'bg-cyan-950 text-cyan-300 border-cyan-500'
                      : 'bg-slate-900 text-slate-400 border-slate-800'
                  }`}
                >
                  A4 (210×297mm)
                </button>
              </div>
            </div>

            {/* Cut Marks */}
            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Scissors className="w-4 h-4 text-cyan-400" />
                <div>
                  <label className="text-xs font-bold text-slate-200">Cut Guides & Crosshairs</label>
                  <p className="text-[11px] text-slate-400">Margin tick lines for rotary trimmers</p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={includeCutMarks}
                onChange={e => setIncludeCutMarks(e.target.checked)}
                className="w-4 h-4 rounded accent-cyan-500 cursor-pointer"
              />
            </div>

            {/* Duplex Backs */}
            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Copy className="w-4 h-4 text-cyan-400" />
                <div>
                  <label className="text-xs font-bold text-slate-200">Duplex Back Sheets</label>
                  <p className="text-[11px] text-slate-400">Mirrored for 2-sided printing</p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={includeBacks}
                onChange={e => setIncludeBacks(e.target.checked)}
                className="w-4 h-4 rounded accent-cyan-500 cursor-pointer"
              />
            </div>

            {/* Pack Margins */}
            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
              <div>
                <label className="text-xs font-bold text-slate-200">Pack Header Labels</label>
                <p className="text-[11px] text-slate-400">Shows pack number on margins</p>
              </div>
              <input
                type="checkbox"
                checked={includePackHeaders}
                onChange={e => setIncludePackHeaders(e.target.checked)}
                className="w-4 h-4 rounded accent-cyan-500 cursor-pointer"
              />
            </div>
          </div>

          {/* Progress bar when rendering PDF */}
          {isExporting && (
            <div className="p-4 rounded-2xl bg-slate-950 border border-cyan-800/60 space-y-2">
              <div className="flex justify-between text-xs text-cyan-300 font-medium">
                <span>{progress.status || 'Rendering PDF sheets...'}</span>
                <span>{progress.percent}%</span>
              </div>
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-cyan-500 h-full transition-all duration-300"
                  style={{ width: `${progress.percent}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-slate-900/90">
          <button
            type="button"
            onClick={handleExportManifest}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors"
          >
            <FileText className="w-4 h-4" />
            Export Text Manifest (.txt)
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handleGeneratePdf}
              disabled={isExporting}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-xs bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-lg shadow-cyan-950/60 hover:shadow-cyan-900/70 active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              {isExporting ? 'Generating PDF...' : 'Download Printable PDF'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
