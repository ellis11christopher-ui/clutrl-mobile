import assert from 'node:assert/strict';
import test from 'node:test';
import { ads, demoHunt } from '../src/data/demo';
import {
  buildCompletionPlan,
  buildPreClueAds,
  isValidTarget,
} from '../src/domain/huntFlow';

test('places one sponsor message before a clue', () => {
  const queue = buildPreClueAds(ads);
  assert.equal(queue.length, 1);
  assert.equal(queue[0]?.placement.moment, 'before-clue');
});

test('places exactly one post-find message between items, and no pre-clue message', () => {
  const clue = demoHunt.clues[0]!;
  const plan = buildCompletionPlan({
    clue,
    clueCount: demoHunt.clues.length,
    currentIndex: 0,
    completedIds: [],
    ads,
  });

  assert.equal(plan.ads.length, 1);
  assert.deepEqual(
    plan.ads.map((step) => step.placement.moment),
    ['after-find'],
  );
  assert.equal(plan.destination, 'clue');
  assert.equal(plan.nextIndex, 1);
  assert.deepEqual(plan.completedIds, [clue.id]);
});

test('finishes after one post-find message on the final target', () => {
  const lastIndex = demoHunt.clues.length - 1;
  const clue = demoHunt.clues[lastIndex]!;
  const plan = buildCompletionPlan({
    clue,
    clueCount: demoHunt.clues.length,
    currentIndex: lastIndex,
    completedIds: demoHunt.clues.slice(0, lastIndex).map((item) => item.id),
    ads,
  });

  assert.equal(plan.ads.length, 1);
  assert.equal(plan.destination, 'reward');
  assert.equal(plan.completedIds.length, 10);
});

test('accepts only the QR value assigned to the current clue', () => {
  const current = demoHunt.clues[3]!;
  assert.equal(isValidTarget(current.qrValue, current), true);
  assert.equal(isValidTarget(demoHunt.clues[4]!.qrValue, current), false);
});
