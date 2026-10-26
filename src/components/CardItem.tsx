import React from 'react';
import { Card } from '../types/card';
import { MANA, RARITY, frameIdentity, colorPips } from '../utils/cardHelpers';
import { getCardArt } from '../utils/cardArt';
import { ManaCost } from './ManaCost';
import { RulesText } from './RulesText';
import { cx } from './ui/cx';

/** Art window proportions of the SWTG frame (width / height). */
export const ART_ASPECT = 'aspect-[311/226]';

interface CardItemProps {
  card: Card;
  onClick?: () => void;
  /** Show the card back. Switching from true to false plays the flip (pack opener only). */
  faceDown?: boolean;
  /** Render both faces so the card can flip. */
  flippable?: boolean;
  isFoil?: boolean;
  /** Picks one of several printings for cards that have them (basic lands). */
  artSeed?: number;
  /** Overrides the accessible name, e.g. for face-down cards. */
  label?: string;
  /** Load the art immediately instead of lazily (cards known to be on screen). */
  eagerArt?: boolean;
}

const CardFace: React.FC<{ card: Card; isFoil?: boolean; artSeed?: number; eagerArt?: boolean }> = ({
  card,
  isFoil,
  artSeed,
  eagerArt,
}) => {
  const identity = frameIdentity(card);
  const mana = MANA[identity];
  const art = getCardArt(card, artSeed);
  const isMythic = card.rarity === 'M';
  const isRare = card.rarity === 'R';
  // Real scans get no sheen overlay, so a foil one is marked by its frame instead.
  const foilRing = Boolean(isFoil && card.scryfall);
  const pips = colorPips(card);
  const hasText = Boolean(card.text || card.flavorText);

  return (
    <span
      className={cx(
        '@container relative flex size-full flex-col gap-1 overflow-hidden rounded-[0.8rem] border-2 bg-gradient-to-b p-1.5 text-left',
        mana.frame,
        foilRing ? 'ring-2 ring-foil/70' : isMythic ? 'ring-1 ring-rarity-m/70' : isRare && 'ring-1 ring-rarity-r/50'
      )}
    >
      {/* Title bar */}
      <span className={cx('flex items-center justify-between gap-1.5 rounded-md border px-2 py-1 shadow-sm', mana.bar)}>
        <span
          title={card.name}
          className="min-w-0 truncate @max-[11.5rem]:whitespace-normal @max-[11.5rem]:line-clamp-2 text-card-name font-stretch-semi-condensed text-fg-strong"
        >
          {card.name}
        </span>
        <ManaCost cost={card.cost} />
      </span>

      {/* Art window: grows into the text box's space when there is no text, or the thumbnail is too narrow for it */}
      <span
        className={cx(
          'relative w-full overflow-hidden rounded-md border border-black/60 bg-well',
          hasText ? cx(ART_ASPECT, '@max-[11.5rem]:aspect-auto @max-[11.5rem]:min-h-0 @max-[11.5rem]:flex-1') : 'min-h-0 flex-1'
        )}
      >
        {art ? (
          <img
            src={art.src}
            width={art.width}
            height={art.height}
            alt=""
            crossOrigin="anonymous"
            loading={eagerArt ? 'eager' : 'lazy'}
            decoding="async"
            draggable={false}
            className="absolute inset-0 size-full object-cover"
          />
        ) : (
          <span className="absolute inset-0 grid place-items-center bg-[radial-gradient(ellipse_at_top,rgb(255_255_255/0.08),transparent_70%)]">
            <span className="flex items-center gap-1" aria-hidden>
              {(pips.length ? pips : (['Colorless'] as const)).map(c => (
                <span key={c} className={cx('size-3 rounded-full border border-black/40', MANA[c].swatch)} />
              ))}
            </span>
          </span>
        )}
        {(isFoil || isMythic) && !card.scryfall && (
          <span
            aria-hidden
            className={cx(
              'foil-sheen pointer-events-none absolute inset-0',
              'group-hover:bg-position-[0%_0%] motion-safe:animate-foil-sweep'
            )}
          />
        )}
        {isFoil && (
          <span
            aria-hidden
            className="absolute left-1 top-1 rounded-sm border border-purple-300/50 bg-black/75 px-1 text-label uppercase text-rarity-t"
          >
            Foil
          </span>
        )}
      </span>

      {/* Type line + rarity gem */}
      <span className="flex items-center justify-between gap-1 rounded-md border border-black/40 bg-black/45 px-2 py-0.5">
        <span title={card.type} className="min-w-0 truncate text-card-small font-medium font-stretch-semi-condensed text-fg-soft">
          {card.type}
        </span>
        <span
          className={cx('shrink-0 rounded-sm border px-1 text-card-small font-bold leading-snug', RARITY[card.rarity].badge)}
          title={RARITY[card.rarity].label}
        >
          {card.rarity}
        </span>
      </span>

      {/* Rules text: dropped on narrow thumbnails, where the inspect dialog carries it */}
      {hasText && (
        <span className="min-h-0 flex-1 overflow-hidden rounded-md border border-black/40 bg-black/55 px-2 py-1.5 @max-[11.5rem]:hidden">
          {card.text ? (
            <span className="line-clamp-3 text-card-small font-[450] text-fg">
              <RulesText text={card.text.replace(/\n/g, ' ')} paragraphClassName="inline" />
            </span>
          ) : (
            <span className="line-clamp-3 text-card-small italic text-fg-muted">{card.flavorText}</span>
          )}
        </span>
      )}

      {/* Footer: artist + power/toughness */}
      <span className="mt-auto flex items-center justify-between gap-1 px-0.5 text-card-small text-fg-muted">
        <span className="min-w-0 truncate font-stretch-semi-condensed" title={card.artist || undefined}>
          {card.artist ? `Illus. ${card.artist}` : RARITY[card.rarity].label}
        </span>
        {card.powerToughness && (
          <span className="shrink-0 rounded-md border border-foil/40 bg-black/80 px-1.5 text-card-cost text-amber-200 leading-normal">
            {card.powerToughness}
          </span>
        )}
      </span>
    </span>
  );
};

const CardBack: React.FC = () => (
  <span className="relative flex size-full flex-col items-center justify-between overflow-hidden rounded-[0.8rem] border-2 border-amber-900/70 bg-gradient-to-br from-slate-950 via-indigo-950 to-black p-3">
    <span aria-hidden className="absolute inset-1.5 rounded-[0.6rem] border border-foil/25" />
    <span aria-hidden className="absolute inset-3 rounded-md border border-slate-700/40" />
    <span className="relative mt-1 text-label uppercase text-foil/80">CardForge</span>
    <span
      aria-hidden
      className="relative grid place-items-center w-3/5 aspect-[3/4] rounded-[50%] border-2 border-foil/40 bg-[radial-gradient(circle_at_50%_40%,rgb(251_191_36/0.18),transparent_65%)] shadow-[inset_0_2px_12px_rgb(0_0_0/0.6)]"
    >
      <span className="w-3/5 aspect-[3/4] rounded-[50%] border border-accent/30" />
    </span>
    <span className="relative mb-1 text-xs font-semibold text-fg-soft group-hover:text-foil transition-colors duration-150">
      Reveal
    </span>
  </span>
);

export const CardItem: React.FC<CardItemProps> = ({
  card,
  onClick,
  faceDown = false,
  flippable = false,
  isFoil,
  artSeed,
  label,
  eagerArt,
}) => {
  const name = label ?? `${card.name}, ${RARITY[card.rarity].label}${isFoil ? ', foil' : ''}`;
  const isMythic = card.rarity === 'M';

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={name}
      aria-haspopup={faceDown ? undefined : 'dialog'}
      className={cx(
        'group relative block w-full aspect-[63/88] rounded-[0.8rem] cursor-pointer select-none',
        'transition-[translate,box-shadow] duration-200 ease-out-expo hover:-translate-y-1 motion-reduce:hover:translate-y-0',
        'shadow-lg shadow-black/50 hover:shadow-xl hover:shadow-black/60',
        !faceDown && isMythic && 'shadow-rarity-m-soft/50',
        flippable && 'perspective-[1100px]'
      )}
    >
      {flippable ? (
        <span
          className={cx(
            'relative block size-full transform-3d transition-transform duration-[650ms] ease-out-expo motion-reduce:transition-none motion-reduce:transform-none',
            faceDown && 'rotate-y-180'
          )}
        >
          <span
            className={cx(
              'absolute inset-0 block backface-hidden',
              'motion-reduce:transition-opacity motion-reduce:duration-200',
              faceDown && 'motion-reduce:opacity-0'
            )}
          >
            <CardFace card={card} isFoil={isFoil} artSeed={artSeed} eagerArt />
          </span>
          <span
            className={cx(
              'absolute inset-0 block backface-hidden rotate-y-180 motion-reduce:transform-none',
              'motion-reduce:transition-opacity motion-reduce:duration-200',
              !faceDown && 'motion-reduce:opacity-0'
            )}
          >
            <CardBack />
          </span>
        </span>
      ) : (
        <CardFace card={card} isFoil={isFoil} artSeed={artSeed} eagerArt={eagerArt} />
      )}
    </button>
  );
};
