import jsPDF from 'jspdf';
import { Card, BoosterPack } from '../types/card';
import { getRarityLabel } from './cardHelpers';
import { getCardArt } from './cardArt';
import { plainRulesText } from './rulesText';

export interface PdfExportOptions {
  paperSize: 'letter' | 'a4';
  orientation: 'portrait';
  includeCutMarks: boolean;
  includeBacks: boolean;
  includePackHeaders: boolean;
  cardsPerSheet: 9; // 3x3 layout
  bleedMm: number; // 0 or 1.5mm
  customBackText?: string;
  /** 'scan' prints the original card scan where one exists; 'layout' draws the generated card face. */
  faceStyle?: 'scan' | 'layout';
  /** Start every pack on a fresh sheet, leaving the rest of the previous sheet empty. */
  newSheetPerPack?: boolean;
}

interface PreparedImage {
  data: string;
  /** jsPDF alias, so each distinct image is embedded in the file once. */
  alias: string;
}

/** Decode an image and re-encode it as JPEG, center-cropped to `aspect` (w/h) when given. */
async function loadAsJpeg(url: string, aspect?: number): Promise<string | null> {
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const sw = img.naturalWidth;
    const sh = img.naturalHeight;
    let sx = 0;
    let sy = 0;
    let cw = sw;
    let ch = sh;
    if (aspect) {
      if (sw / sh > aspect) {
        cw = Math.round(sh * aspect);
        sx = Math.round((sw - cw) / 2);
      } else {
        ch = Math.round(sw / aspect);
        sy = Math.round((sh - ch) / 2);
      }
    }
    const canvas = document.createElement('canvas');
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(img, sx, sy, cw, ch, 0, 0, cw, ch);
    return canvas.toDataURL('image/jpeg', 0.92);
  } catch {
    return null;
  }
}

// Standard MTG / Poker card dimensions in mm
export const CARD_WIDTH_MM = 63;
export const CARD_HEIGHT_MM = 88;

/** Art box of the generated layout, in mm (see drawCardFace). */
const LAYOUT_ART = { x: 4, y: 12.5, w: CARD_WIDTH_MM - 8, h: 28 };

export async function generatePrintPdf(
  packs: BoosterPack[],
  options: PdfExportOptions,
  onProgress?: (progress: number, status: string) => void
): Promise<Blob> {
  const isA4 = options.paperSize === 'a4';
  // A4: 210 x 297 mm; Letter: 215.9 x 279.4 mm
  const pageWidth = isA4 ? 210 : 215.9;
  const pageHeight = isA4 ? 297 : 279.4;

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: options.paperSize === 'a4' ? 'a4' : 'letter',
  });

  const cols = 3;
  const rows = 3;
  const totalGridWidth = cols * CARD_WIDTH_MM;
  const totalGridHeight = rows * CARD_HEIGHT_MM;

  const marginX = (pageWidth - totalGridWidth) / 2;
  const marginY = (pageHeight - totalGridHeight) / 2;

  // Collect all cards to print, tagged with their pack index
  interface PrintableItem {
    card: Card;
    packNumber: number;
    cardIndexInPack: number;
  }

  const items: (PrintableItem | null)[] = [];
  packs.forEach(pack => {
    if (options.newSheetPerPack) {
      while (items.length % 9 !== 0) items.push(null);
    }
    pack.cards.forEach((card, idx) => {
      items.push({
        card,
        packNumber: pack.packNumber,
        cardIndexInPack: idx + 1,
      });
    });
  });

  // Load artwork once per distinct image before drawing.
  const faceStyle = options.faceStyle ?? 'scan';
  const artAspect = LAYOUT_ART.w / LAYOUT_ART.h;
  const scanFor = new Map<PrintableItem, PreparedImage>();
  const artFor = new Map<PrintableItem, PreparedImage>();
  const cache = new Map<string, Promise<string | null>>();
  const load = (key: string, url: string, aspect?: number) => {
    if (!cache.has(key)) cache.set(key, loadAsJpeg(url, aspect));
    return cache.get(key)!;
  };

  const printable = items.filter((i): i is PrintableItem => i !== null);
  let loaded = 0;
  await Promise.all(
    printable.map(async item => {
      // Same seed as the on-screen pack, so basic lands print with the art you saw.
      const pack = packs.find(p => p.packNumber === item.packNumber);
      const art = getCardArt(item.card, item.packNumber * 31 + (pack ? pack.cards.indexOf(item.card) : 0));
      if (art?.fullSrc && faceStyle === 'scan') {
        const data = await load(`scan:${art.fullSrc}`, art.fullSrc);
        if (data) scanFor.set(item, { data, alias: `scan:${art.fullSrc}` });
      }
      if (art && !scanFor.has(item)) {
        const data = await load(`art:${art.src}`, art.src, artAspect);
        if (data) artFor.set(item, { data, alias: `art:${art.src}` });
      }
      loaded++;
      if (onProgress && loaded % 9 === 0) {
        onProgress(Math.round((loaded / printable.length) * 30), `Loading artwork (${loaded} of ${printable.length})…`);
      }
    })
  );

  const totalPages = Math.ceil(items.length / 9);
  let isFirstPage = true;

  for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
    if (!isFirstPage) {
      pdf.addPage(options.paperSize === 'a4' ? 'a4' : 'letter', 'portrait');
    }
    isFirstPage = false;

    if (onProgress) {
      onProgress(30 + Math.round(((pageIdx + 1) / totalPages) * 70), `Drawing sheet ${pageIdx + 1} of ${totalPages}…`);
      // Yield so the progress bar can repaint between sheets.
      await new Promise(resolve => setTimeout(resolve, 0));
    }

    const pageSlots = items.slice(pageIdx * 9, (pageIdx + 1) * 9);
    const pageCards = pageSlots.filter((i): i is PrintableItem => i !== null);

    // Page Header / Pack Info
    if (options.includePackHeaders) {
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8);
      pdf.setTextColor(120, 120, 120);
      const packsOnThisSheet = Array.from(new Set(pageCards.map(p => p.packNumber))).join(', ');
      pdf.text(
        `CardForge Print Sheet ${pageIdx + 1}/${totalPages} • Packs: #${packsOnThisSheet} • Standard 63×88mm (Poker/MTG)`,
        marginX,
        Math.max(6, marginY - 3)
      );
    }

    // Draw cards in 3x3 grid
    pageSlots.forEach((item, slotIdx) => {
      if (!item) return;
      const col = slotIdx % cols;
      const row = Math.floor(slotIdx / cols);
      const x = marginX + col * CARD_WIDTH_MM;
      const y = marginY + row * CARD_HEIGHT_MM;

      const scan = scanFor.get(item);
      if (scan) {
        pdf.addImage(scan.data, 'JPEG', x, y, CARD_WIDTH_MM, CARD_HEIGHT_MM, scan.alias);
      } else {
        drawCardFace(pdf, item.card, x, y, item.packNumber, artFor.get(item));
      }
    });

    // Draw Cut Lines and Registration Crosshairs
    if (options.includeCutMarks) {
      drawCutGuides(pdf, marginX, marginY, cols, rows, CARD_WIDTH_MM, CARD_HEIGHT_MM, pageWidth, pageHeight);
    }

    // Optional Duplex Backs
    if (options.includeBacks) {
      pdf.addPage(options.paperSize === 'a4' ? 'a4' : 'letter', 'portrait');
      // For double-sided alignment, mirror columns horizontally: col 0 -> col 2, col 2 -> col 0
      pageSlots.forEach((item, slotIdx) => {
        if (!item) return;
        const originalCol = slotIdx % cols;
        const mirroredCol = (cols - 1) - originalCol;
        const row = Math.floor(slotIdx / cols);
        const x = marginX + mirroredCol * CARD_WIDTH_MM;
        const y = marginY + row * CARD_HEIGHT_MM;

        drawCardBack(pdf, x, y, options.customBackText || 'STAR WARS TCG');
      });

      if (options.includeCutMarks) {
        drawCutGuides(pdf, marginX, marginY, cols, rows, CARD_WIDTH_MM, CARD_HEIGHT_MM, pageWidth, pageHeight);
      }
    }
  }

  return pdf.output('blob');
}

function drawCardFace(pdf: jsPDF, card: Card, x: number, y: number, packNum: number, art?: PreparedImage): void {
  const w = CARD_WIDTH_MM;
  const h = CARD_HEIGHT_MM;

  // Outer border / Card frame
  pdf.setDrawColor(30, 30, 30);
  pdf.setLineWidth(0.3);
  pdf.setFillColor(248, 249, 250);
  pdf.roundedRect(x, y, w, h, 2, 2, 'FD');

  // Background frame tint depending on rarity/color
  let frameColor: [number, number, number] = [235, 238, 242];
  if (card.colors?.includes('W')) frameColor = [252, 250, 242];
  else if (card.colors?.includes('U')) frameColor = [228, 241, 254];
  else if (card.colors?.includes('B')) frameColor = [220, 220, 225];
  else if (card.colors?.includes('R')) frameColor = [254, 235, 235];
  else if (card.colors?.includes('G')) frameColor = [232, 248, 238];
  else if (card.colors?.includes('Multicolor')) frameColor = [253, 246, 227];

  pdf.setFillColor(frameColor[0], frameColor[1], frameColor[2]);
  pdf.rect(x + 2, y + 2, w - 4, h - 4, 'F');

  // Inner card boundary
  pdf.setDrawColor(60, 60, 60);
  pdf.setLineWidth(0.2);
  pdf.rect(x + 2.5, y + 2.5, w - 5, h - 5, 'D');

  // Title bar
  pdf.setFillColor(255, 255, 255);
  pdf.setDrawColor(80, 80, 80);
  pdf.roundedRect(x + 3.5, y + 4, w - 7, 7, 1, 1, 'FD');

  // Title text
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(7.5);
  pdf.setTextColor(20, 20, 20);
  const title = card.name.length > 22 ? card.name.substring(0, 20) + '...' : card.name;
  pdf.text(title, x + 5, y + 8.8);

  // Mana Cost
  if (card.cost) {
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7);
    pdf.setTextColor(60, 60, 60);
    pdf.text(card.cost, x + w - 5, y + 8.8, { align: 'right' });
  }

  // Art box: the card's artwork, or a neutral panel for cards without art
  if (art) {
    pdf.addImage(art.data, 'JPEG', x + LAYOUT_ART.x, y + LAYOUT_ART.y, LAYOUT_ART.w, LAYOUT_ART.h, art.alias);
    pdf.setDrawColor(60, 60, 60);
    pdf.setLineWidth(0.2);
    pdf.rect(x + LAYOUT_ART.x, y + LAYOUT_ART.y, LAYOUT_ART.w, LAYOUT_ART.h, 'D');
  } else {
    pdf.setFillColor(215, 222, 230);
    pdf.setDrawColor(120, 120, 120);
    pdf.rect(x + LAYOUT_ART.x, y + LAYOUT_ART.y, LAYOUT_ART.w, LAYOUT_ART.h, 'FD');
  }

  // Type line bar
  pdf.setFillColor(255, 255, 255);
  pdf.roundedRect(x + 3.5, y + 42, w - 7, 5.5, 1, 1, 'FD');

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(6.5);
  pdf.setTextColor(30, 30, 30);
  const typeText = card.type.length > 28 ? card.type.substring(0, 26) + '...' : card.type;
  pdf.text(typeText, x + 5, y + 45.8);

  // Rarity Symbol / Badge
  let rarityBadgeColor: [number, number, number] = [100, 100, 100];
  if (card.rarity === 'U') rarityBadgeColor = [40, 110, 180];
  else if (card.rarity === 'R') rarityBadgeColor = [190, 140, 20];
  else if (card.rarity === 'M') rarityBadgeColor = [220, 70, 20];
  else if (card.rarity === 'L') rarityBadgeColor = [40, 140, 60];

  pdf.setFillColor(rarityBadgeColor[0], rarityBadgeColor[1], rarityBadgeColor[2]);
  pdf.circle(x + w - 6.5, y + 44.8, 1.8, 'F');
  pdf.setTextColor(255, 255, 255);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(5);
  pdf.text(card.rarity, x + w - 6.5, y + 45.6, { align: 'center' });

  // Text Box
  pdf.setFillColor(255, 255, 255);
  pdf.setDrawColor(140, 140, 140);
  pdf.roundedRect(x + 3.5, y + 49, w - 7, 28, 1, 1, 'FD');

  // Card Text
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(5.8);
  pdf.setTextColor(30, 30, 30);

  const textLines = pdf.splitTextToSize(plainRulesText(card.text || ''), w - 10);
  const maxLines = 6;
  const displayLines = textLines.slice(0, maxLines);
  let textY = y + 52.8;

  displayLines.forEach((line: string) => {
    pdf.text(line, x + 5, textY);
    textY += 3.1;
  });

  // Flavor Text
  if (card.flavorText && displayLines.length <= 4) {
    pdf.setFont('helvetica', 'italic');
    pdf.setFontSize(5.2);
    pdf.setTextColor(110, 110, 110);
    const flavorLines = pdf.splitTextToSize(card.flavorText, w - 10).slice(0, 2);
    flavorLines.forEach((line: string) => {
      pdf.text(line, x + 5, textY + 1);
      textY += 2.8;
    });
  }

  // Power / Toughness Box
  if (card.powerToughness) {
    pdf.setFillColor(245, 245, 245);
    pdf.setDrawColor(60, 60, 60);
    pdf.roundedRect(x + w - 16, y + 72.5, 12, 5.5, 1, 1, 'FD');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7.5);
    pdf.setTextColor(20, 20, 20);
    pdf.text(card.powerToughness, x + w - 10, y + 76.4, { align: 'center' });
  }

  // Bottom Footer / Artist & Pack Index
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(4.8);
  pdf.setTextColor(100, 100, 100);
  const artistText = card.artist ? `Illus. ${card.artist}` : 'CardForge';
  pdf.text(artistText, x + 4, y + 80);
  pdf.text(`Pack #${packNum} • ${getRarityLabel(card.rarity)}`, x + 4, y + 83);
}

function drawCardBack(pdf: jsPDF, x: number, y: number, backTitle: string): void {
  const w = CARD_WIDTH_MM;
  const h = CARD_HEIGHT_MM;

  // Dark card back border
  pdf.setFillColor(15, 20, 28);
  pdf.setDrawColor(40, 48, 60);
  pdf.roundedRect(x, y, w, h, 2, 2, 'FD');

  // Decorative inner frame
  pdf.setDrawColor(212, 175, 55); // Gold accent
  pdf.setLineWidth(0.4);
  pdf.rect(x + 3.5, y + 3.5, w - 7, h - 7, 'D');

  pdf.setDrawColor(70, 85, 110);
  pdf.rect(x + 5, y + 5, w - 10, h - 10, 'D');

  // Center emblem
  pdf.setFillColor(26, 34, 48);
  pdf.circle(x + w / 2, y + h / 2, 16, 'FD');

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8.5);
  pdf.setTextColor(230, 200, 110);
  pdf.text(backTitle, x + w / 2, y + h / 2 - 2, { align: 'center' });

  pdf.setFontSize(5.5);
  pdf.setTextColor(170, 185, 205);
  pdf.text('COLLECTIBLE CARD GAME', x + w / 2, y + h / 2 + 4, { align: 'center' });
}

function drawCutGuides(
  pdf: jsPDF,
  marginX: number,
  marginY: number,
  cols: number,
  rows: number,
  cardW: number,
  cardH: number,
  pageW: number,
  pageH: number
): void {
  pdf.setDrawColor(160, 160, 160);
  pdf.setLineWidth(0.15);

  const lineLength = 5; // mm ticks

  // Vertical cut lines (top and bottom edges)
  for (let c = 0; c <= cols; c++) {
    const x = marginX + c * cardW;
    // Top marks
    pdf.line(x, 0, x, lineLength);
    // Bottom marks
    pdf.line(x, pageH, x, pageH - lineLength);

    // Crosshairs inside gaps if spacing exists
    if (c > 0 && c < cols) {
      pdf.setDrawColor(200, 200, 200);
      for (let r = 1; r < rows; r++) {
        const y = marginY + r * cardH;
        pdf.line(x - 2, y, x + 2, y);
        pdf.line(x, y - 2, x, y + 2);
      }
    }
  }

  // Horizontal cut lines (left and right edges)
  pdf.setDrawColor(160, 160, 160);
  for (let r = 0; r <= rows; r++) {
    const y = marginY + r * cardH;
    // Left marks
    pdf.line(0, y, lineLength, y);
    // Right marks
    pdf.line(pageW, y, pageW - lineLength, y);
  }
}
