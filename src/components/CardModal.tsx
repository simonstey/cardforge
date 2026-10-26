import React, { useId, useState } from 'react';
import { Card } from '../types/card';
import { MANA, RARITY, colorPips, setDisplayName } from '../utils/cardHelpers';
import { getCardSetCode } from '../utils/boosterCollation';
import { getCardArt } from '../utils/cardArt';
import { Dialog } from './ui/Dialog';
import { Button, IconButton } from './ui/Button';
import { ManaCost } from './ManaCost';
import { RulesText } from './RulesText';
import { CardItem } from './CardItem';
import { cx } from './ui/cx';
import { X, Pencil, Trash2, Repeat2 } from 'lucide-react';

interface CardModalProps {
  card: Card;
  /** Which printing to show for cards with several (basic lands), matching the thumbnail. */
  artSeed?: number;
  onClose: () => void;
  onEdit?: (card: Card) => void;
  onDelete?: (id: string) => void;
}

export const CardModal: React.FC<CardModalProps> = ({ card, artSeed, onClose, onEdit, onDelete }) => {
  const id = useId();
  const art = getCardArt(card, artSeed);
  const [showBack, setShowBack] = useState(false);
  const pips = colorPips(card);
  const rarity = RARITY[card.rarity];
  const setCode = getCardSetCode(card);
  const setName = card.source
    ? `${setDisplayName(setCode, [card])}${card.rarity === 'T' ? ' · Tokens' : card.rarity === 'L' ? ' · Basic lands' : ''}`
    : undefined;
  const hasBack = Boolean(card.backFace || art?.fullBackSrc);
  // The face whose text is shown: the back face's details when it is turned over.
  const face = showBack && card.backFace ? card.backFace : card;

  return (
    <Dialog labelledBy={`${id}-title`} onClose={onClose} className="sm:w-[min(100%-2rem,52rem)]">
      <div className="flex max-h-[inherit] flex-col">
        <div className="flex items-start justify-between gap-3 border-b border-line px-6 py-4">
          <div className="min-w-0">
            <h2 id={`${id}-title`} className="text-xl font-bold text-fg-strong">
              {face.name}
            </h2>
            <p className="text-sm text-fg-muted">{face.type}</p>
          </div>
          <div className="flex items-center gap-3">
            {!showBack && <ManaCost cost={card.cost} size="md" />}
            <IconButton label="Close" variant="ghost" onClick={onClose} autoFocus>
              <X aria-hidden className="size-5" />
            </IconButton>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid gap-6 sm:grid-cols-[minmax(0,17rem)_1fr]">
            <div className="mx-auto w-full max-w-[17rem]">
              {art?.fullSrc ? (
                <>
                  <img
                    src={showBack && art.fullBackSrc ? art.fullBackSrc : art.fullSrc}
                    width={art.fullWidth}
                    height={art.fullHeight}
                    crossOrigin="anonymous"
                    alt={`Original card scan of ${card.name}${showBack ? ', back face' : ''}`}
                    className="w-full h-auto rounded-[0.9rem] shadow-xl shadow-black/60"
                  />
                  {hasBack && (
                    <Button aria-pressed={showBack} onClick={() => setShowBack(b => !b)} className="mt-3 w-full">
                      <Repeat2 aria-hidden className="size-4" />
                      {showBack ? 'Show front face' : 'Show other face'}
                    </Button>
                  )}
                </>
              ) : (
                <div inert>
                  <CardItem card={card} eagerArt />
                </div>
              )}
            </div>

            <div className="min-w-0 space-y-4">
              <dl className="grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-xl border border-line bg-well/70 px-3 py-2">
                  <dt className="text-xs text-fg-muted">Rarity</dt>
                  <dd className={cx('font-semibold', rarity.text)}>{rarity.label}</dd>
                </div>
                <div className="rounded-xl border border-line bg-well/70 px-3 py-2">
                  <dt className="text-xs text-fg-muted">Color</dt>
                  <dd className="flex flex-wrap items-center gap-x-2 font-semibold text-fg">
                    {pips.length === 0
                      ? 'Colorless'
                      : pips.map(c => (
                          <span key={c} className="inline-flex items-center gap-1">
                            <span aria-hidden className={cx('size-2.5 rounded-full', MANA[c].swatch)} />
                            {MANA[c].label}
                          </span>
                        ))}
                  </dd>
                </div>
                {face.powerToughness && (
                  <div className="rounded-xl border border-line bg-well/70 px-3 py-2">
                    <dt className="text-xs text-fg-muted">{/planeswalker/i.test(face.type) ? 'Loyalty' : 'Power / toughness'}</dt>
                    <dd className="font-bold text-amber-200">{face.powerToughness}</dd>
                  </div>
                )}
                {setName && (
                  <div className="rounded-xl border border-line bg-well/70 px-3 py-2">
                    <dt className="text-xs text-fg-muted">Set</dt>
                    <dd className="font-semibold text-fg">{setName}</dd>
                  </div>
                )}
              </dl>

              {face.text && (
                <div className="space-y-2 rounded-xl border border-line bg-well/70 p-4 text-sm leading-relaxed text-fg">
                  <RulesText text={face.text} size="md" />
                </div>
              )}

              {face.flavorText && (
                <p className="px-1 text-sm italic leading-relaxed text-fg-muted whitespace-pre-line">{face.flavorText}</p>
              )}

              <p className="px-1 text-sm text-fg-muted">
                Illustrated by <span className="text-fg-soft">{card.artist || 'an unknown artist'}</span>
              </p>
            </div>
          </div>
        </div>

        {(onEdit || onDelete) && (
          <div className="flex justify-end gap-2 border-t border-line px-6 py-4">
            {onDelete && (
              <Button variant="danger" size="md" onClick={() => onDelete(card.id)}>
                <Trash2 aria-hidden className="size-4" />
                Delete card
              </Button>
            )}
            {onEdit && (
              <Button variant="primary" size="md" onClick={() => onEdit(card)}>
                <Pencil aria-hidden className="size-4" />
                Edit card
              </Button>
            )}
          </div>
        )}
      </div>
    </Dialog>
  );
};
