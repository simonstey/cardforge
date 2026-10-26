import { expect, test } from 'vitest';
import { fitInBox } from './pdfGenerator';

test('fitInBox letterboxes a whole card in the art box without cropping it', () => {
  const box = { x: 4, y: 12.5, w: 55, h: 28 };
  const fit = fitInBox(box, 672 / 936);
  // Full height, proportional width, centred: nothing of the card falls outside the box.
  expect(fit.h).toBeCloseTo(28);
  expect(fit.w).toBeCloseTo(28 * (672 / 936));
  expect(fit.w / fit.h).toBeCloseTo(672 / 936);
  expect(fit.x).toBeCloseTo(4 + (55 - fit.w) / 2);
  expect(fit.y).toBeCloseTo(12.5);
});

test('fitInBox fits a wide image to the box width', () => {
  const fit = fitInBox({ x: 0, y: 0, w: 10, h: 10 }, 2);
  expect(fit).toEqual({ x: 0, y: 2.5, w: 10, h: 5 });
});
