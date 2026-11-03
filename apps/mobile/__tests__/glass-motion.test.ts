import { jellyShape, releaseTab, rubberBand } from '../src/glassMotion';

test('release uses flick momentum and clamps to a real tab', () => {
  expect(releaseTab(85, 0, 100, 4)).toBe(1);
  expect(releaseTab(85, 1.4, 100, 4)).toBe(2);
  expect(releaseTab(220, -1.4, 100, 4)).toBe(1);
  expect(releaseTab(-500, -100, 100, 4)).toBe(0);
  expect(releaseTab(500, 100, 100, 4)).toBe(3);
  expect(releaseTab(50, 1, 0, 4)).toBe(0);
});

test('rubber band resists overscroll and jelly deformation stays bounded', () => {
  expect(rubberBand(150, 300)).toBe(150);
  expect(rubberBand(-100, 300)).toBeGreaterThan(-100);
  expect(rubberBand(400, 300)).toBeLessThan(400);
  expect(jellyShape(0)).toEqual({ x: 1, y: 1 });
  expect(jellyShape(1)).toEqual(jellyShape(-1));
  expect(jellyShape(100).x).toBeLessThanOrEqual(1.24);
  expect(jellyShape(100).y).toBeGreaterThan(0.8);
});
