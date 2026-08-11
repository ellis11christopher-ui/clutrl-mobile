import type { AdPlacement, Clue, Screen } from '../types';

export type AdStep = {
  placement: AdPlacement;
  label: string;
};

export type CompletionPlan = {
  completedIds: string[];
  nextIndex: number;
  ads: AdStep[];
  destination: Screen;
};

export function buildPreClueAds(ad: AdPlacement[]): AdStep[] {
  const placement = ad.find((item) => item.moment === 'before-clue');
  return placement ? [{ placement, label: 'A word from today’s sponsor' }] : [];
}

export function buildCompletionPlan({
  clue,
  clueCount,
  currentIndex,
  completedIds,
  ads,
}: {
  clue: Clue;
  clueCount: number;
  currentIndex: number;
  completedIds: string[];
  ads: AdPlacement[];
}): CompletionPlan {
  const nextCompletedIds = completedIds.includes(clue.id)
    ? completedIds
    : [...completedIds, clue.id];
  const postFindPlacement = ads.find((item) => item.moment === 'after-find');
  const postAds = postFindPlacement
    ? [{ placement: postFindPlacement, label: 'Find confirmed · Sponsor message' }]
    : [];
  const isFinal = currentIndex >= clueCount - 1;

  if (isFinal) {
    return {
      completedIds: nextCompletedIds,
      nextIndex: currentIndex,
      ads: postAds,
      destination: 'reward',
    };
  }

  return {
    completedIds: nextCompletedIds,
    nextIndex: currentIndex + 1,
    ads: postAds,
    destination: 'clue',
  };
}

export function isValidTarget(scannedValue: string, clue: Clue): boolean {
  return scannedValue.trim().toLowerCase() === clue.qrValue.toLowerCase();
}
