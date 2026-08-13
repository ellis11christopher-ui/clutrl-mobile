export type HuntTier = 'base' | 'live' | 'immersive';
export type AppRole = 'hunter' | 'master';
export type ClueKind = 'text' | 'photo' | 'video' | 'ar';

// The CLU/TRL game format (sub-brand) a hunt plays as. Orthogonal to
// HuntTier (which gates platform features like GPS tracking/chat) — format
// is the actual game mechanic. Note HuntTier also has a 'live' value; that's
// an unrelated coincidence (tier 'live' = realtime features unlocked,
// format 'live' = the short single-venue event sub-brand) — don't conflate
// them.
export type HuntFormat = 'pista' | 'hare_hounds' | 'quest' | 'ar' | 'live';
export type Screen =
  | 'auth'
  | 'home'
  | 'celebration'
  | 'ad'
  | 'countdown'
  | 'finale'
  | 'clue'
  | 'scanner'
  | 'joinScan'
  | 'reward'
  | 'tracking'
  | 'chat'
  | 'ar'
  | 'master'
  | 'settings';

export type Coordinates = {
  latitude: number;
  longitude: number;
};

export type Clue = {
  id: string;
  order: number;
  title: string;
  eyebrow: string;
  clue: string;
  hint: string;
  kind: ClueKind;
  qrValue: string;
  visualLabel?: string;
  videoDuration?: string;
  coordinates?: Coordinates;
};

export type Hunt = {
  id: string;
  joinCode: string;
  name: string;
  city: string;
  venue: string;
  accent: string;
  estimatedMinutes: number;
  rewardTitle: string;
  rewardCopy: string;
  rewardCode: string;
  clues: Clue[];
};

export type AdMoment = 'before-clue' | 'after-find';

export type AdPlacement = {
  id: string;
  brand: string;
  headline: string;
  detail: string;
  cta: string;
  colors: [string, string];
  moment: AdMoment;
};

export type Participant = {
  id: string;
  name: string;
  initials: string;
  progress: number;
  lastSeen: string;
  status: 'moving' | 'paused' | 'help';
  color: string;
  mapX: number;
  mapY: number;
};

export type ChatMessage = {
  id: string;
  from: 'hunter' | 'master';
  body: string;
  time: string;
};
