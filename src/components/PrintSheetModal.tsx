import React, { useState } from 'react';
import { BoosterPack } from '../types/card';
import { generatePrintPdf, PdfExportOptions, CARD_WIDTH_MM, CARD_HEIGHT_MM } from '../utils/pdfGenerator';
import { Printer, Download, FileText, CheckCircle2, Scissors, Copy, AlertCircle, X } from 'lucide-react';

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

  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [progress, setProgress] = useState<{ percent: number; status: string }>({ percent: 0, status: '' });
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  const totalCards = packs.reduce((acc, p) => acc + p.cards.length, 0);
  const frontSheetsCount = Math.ceil(totalCards / 9);
  const totalSheetsToPrint = includeBacks ? frontSheetsCount * 2 : frontSheetsCount;

  const handleGeneratePdf = async () => {
    try {
      setIsExporting(true);
      setDownloadUrl(null);
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
      setDownloadUrl(url);

      // Trigger download automatically
      const a = document.createElement('a');
      a.href = url;
      a.download = `CardForge_Booster_Sheets_${packs.length}_Packs_${paperSize.toUpperCase()}.pdf`;
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
    let manifest = `CARDFORGE BOOSTER PACK MANIFEST\nTotal Packs: ${packs.length}\nTotal Cards: ${totalCards}\nGenerated: ${new Date().toLocaleString()}\n\n`;

    packs.forEach(pack => {
      manifest += `========================================\nPACK #${pack.packNumber} ${pack.hasMythic ? '[★ CONTAINS MYTHIC]' : ''}\n========================================\n`;
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-6 text-slate-100 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-950/80 border border-cyan-800/60 text-cyan-400">
              <Printer className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Print-Ready PDF Sheet Generator</h2>
              <p className="text-xs text-slate-400">
                Organized 3×3 sheets with precision crop marks for card stock cutting
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Overview Stats */}
        <div className="grid grid-cols-3 gap-3 my-4">
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
            <span className="text-[11px] text-slate-400">Packs Included</span>
            <div className="text-lg font-bold text-cyan-300 font-mono">{packs.length}</div>
          </div>
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
            <span className="text-[11px] text-slate-400">Total Cards</span>
            <div className="text-lg font-bold text-slate-200 font-mono">{totalCards}</div>
          </div>
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
            <span className="text-[11px] text-slate-400">Print Sheets (Pages)</span>
            <div className="text-lg font-bold text-amber-300 font-mono">
              {totalSheetsToPrint} {includeBacks && <span className="text-xs font-normal text-slate-400">({frontSheetsCount} fronts + {frontSheetsCount} backs)</span>}
            </div>
          </div>
        </div>

        {/* Configuration Options */}
        <div className="space-y-4 my-5 bg-slate-950/40 p-4 rounded-xl border border-slate-800/60">
          {/* Paper Size */}
          <div className="flex items-center justify-between">
            <div>
              <label className="text-xs font-bold text-slate-200">Paper Standard</label>
              <p className="text-[11px] text-slate-400">Standard paper size for your home or print shop printer</p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPaperSize('letter')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                  paperSize === 'letter'
                    ? 'bg-cyan-950 text-cyan-300 border-cyan-600'
                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700'
                }`}
              >
                US Letter (8.5×11")
              </button>
              <button
                type="button"
                onClick={() => setPaperSize('a4')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                  paperSize === 'a4'
                    ? 'bg-cyan-950 text-cyan-300 border-cyan-600'
                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700'
                }`}
              >
                A4 (210×297mm)
              </button>
            </div>
          </div>

          {/* Cutting Guides */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-800">
            <div className="flex items-center gap-2">
              <Scissors className="w-4 h-4 text-slate-400" />
              <div>
                <label className="text-xs font-bold text-slate-200">Cutting Guides & Crop Marks</label>
                <p className="text-[11px] text-slate-400">Include perimeter tick lines and crosshair cut guides for rotary trimmers</p>
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
          <div className="flex items-center justify-between pt-3 border-t border-slate-800">
            <div className="flex items-center gap-2">
              <Copy className="w-4 h-4 text-slate-400" />
              <div>
                <label className="text-xs font-bold text-slate-200">Duplex Back Sheets (Double-Sided)</label>
                <p className="text-[11px] text-slate-400">Generate mirrored card back pages designed for 2-sided printing</p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={includeBacks}
              onChange={e => setIncludeBacks(e.target.checked)}
              className="w-4 h-4 rounded accent-cyan-500 cursor-pointer"
            />
          </div>

          {/* Back text customization */}
          {includeBacks && (
            <div className="pt-2 flex items-center justify-between">
              <label className="text-xs text-slate-300">Card Back Title:</label>
              <input
                type="text"
                value={customBackText}
                onChange={e => setCustomBackText(e.target.value)}
                className="w-48 px-2 py-1 text-xs bg-slate-900 border border-slate-700 rounded-lg text-white"
                placeholder="STAR WARS TCG"
              />
            </div>
          )}

          {/* Pack Header info */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-800">
            <div>
              <label className="text-xs font-bold text-slate-200">Pack Header Labels</label>
              <p className="text-[11px] text-slate-400">Prints subtle margin headers identifying which pack each card belongs to</p>
            </div>
            <input
              type="checkbox"
              checked={includePackHeaders}
              onChange={e => setIncludePackHeaders(e.target.checked)}
              className="w-4 h-4 rounded accent-cyan-500 cursor-pointer"
            />
          </div>
        </div>

        {/* Progress Bar when exporting */}
        {isExporting && (
          <div className="my-4 space-y-2">
            <div className="flex justify-between text-xs text-slate-300">
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

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-800">
          <button
            type="button"
            onClick={handleExportManifest}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors"
          >
            <FileText className="w-4 h-4" />
            Export Text Manifest (.txt)
          </button>

          <div className="flex gap-2">
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
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-lg shadow-cyan-950/50 transition-all disabled:opacity-50 cursor-pointer"
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
