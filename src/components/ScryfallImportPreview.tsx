import React from 'react';
import { Info, TriangleAlert } from 'lucide-react';
import type { ImportPreview } from '../scryfall/importSet';
import { RARITY, RARITY_ORDER } from '../utils/cardHelpers';
import { CardItem } from './CardItem';

const SAMPLE_SIZE = 8;

/** Up to `count` items spread evenly across `items`, in order. */
export function sampleEvenly<T>(items: T[], count: number): T[] {
  if (items.length <= count) return items;
  return Array.from({ length: count }, (_, i) => items[Math.floor((i * items.length) / count)]);
}

const cardsLabel = (n: number) => `${n} ${n === 1 ? 'card' : 'cards'}`;

interface ImportPreviewPanelProps {
  preview: ImportPreview;
  /** The heading takes focus when the preview appears. */
  headingRef?: React.Ref<HTMLHeadingElement>;
}

/** What a confirmed import would add and change (spec 6.6 step 4). Nothing here is saved yet. */
export const ImportPreviewPanel: React.FC<ImportPreviewPanelProps> = ({ preview, headingRef }) => {
  const { incoming, byRarity, sync, skipped, warnings } = preview;
  const label = preview.targets.map(t => t.name).join(', ');
  const changes = [
    { n: sync.added, label: 'new' },
    { n: sync.updated, label: 'updated' },
    { n: sync.unchanged, label: 'unchanged' },
    { n: sync.removed, label: 'removed' },
    { n: sync.protected, label: 'kept because you edited them' },
  ].filter(c => c.n > 0);

  return (
    <section aria-label="Preview" className="space-y-3 rounded-2xl border border-line bg-well/60 p-4">
      <h3 ref={headingRef} tabIndex={-1} className="text-sm font-semibold text-fg-strong focus:outline-none">
        {incoming.length > 0 ? `${cardsLabel(incoming.length)} from ${label}` : `No cards from ${label} match these options.`}
      </h3>

      {incoming.length > 0 && (
        <dl className="flex flex-wrap gap-2">
          {RARITY_ORDER.filter(r => byRarity[r] > 0).map(r => (
            <div key={r} className="rounded-xl border border-line bg-well px-3 py-1.5">
              <dt className={`text-xs ${RARITY[r].text}`}>{RARITY[r].label}</dt>
              <dd className={`text-base font-bold ${RARITY[r].text}`}>{byRarity[r]}</dd>
            </div>
          ))}
        </dl>
      )}

      {changes.length > 0 && (
        <ul aria-label="Changes to your database" className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-fg-soft">
          {changes.map(c => (
            <li key={c.label}>
              <span className="font-semibold text-fg-strong">{c.n}</span> {c.label}
            </li>
          ))}
        </ul>
      )}

      {skipped > 0 && (
        <p className="flex items-start gap-2 text-sm text-fg-muted">
          <Info aria-hidden className="size-4 shrink-0 mt-0.5" />
          {`Skipped ${cardsLabel(skipped)} that CardForge can’t show, such as art series cards.`}
        </p>
      )}
      {warnings.map(w => (
        <p key={w} className="flex items-start gap-2 text-sm text-fg-soft">
          <TriangleAlert aria-hidden className="size-4 shrink-0 mt-0.5 text-warning" />
          {w}
        </p>
      ))}

      {incoming.length > 0 && (
        // A visual sample only; the counts above carry the content, so the thumbnails stay out of the tab order.
        <ul aria-hidden className="flex gap-2 overflow-x-auto pt-1 pb-2">
          {sampleEvenly(incoming, SAMPLE_SIZE).map(card => (
            <li key={card.id} inert className="w-32 shrink-0">
              <CardItem card={card} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
