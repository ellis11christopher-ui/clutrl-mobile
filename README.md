# CLUTRL mobile prototype

CLUTRL ("Clue Trail") is a camera-first scavenger hunt platform prototype. It
demonstrates the hunter experience, tiered access, and the Hunt Master field
view in one Expo/React Native app.

## What is implemented

- One seeded 10-discovery hunt, `Neon After Dark`
- Text, photo, video, and AR clue treatments
- One sponsor placement, shown once before the first clue
- One sponsor placement after each confirmed find
- Real QR scanning through the device camera
- A demo-confirm button when printed targets are unavailable
- Completion state and a reward/coupon ticket
- Base, Live, and Immersive feature gates
- Foreground GPS permission and live coordinate updates
- Hunt Master route and team-status dashboard
- Local clue-assistance messaging
- Camera AR overlay and capture proof of concept
- Printable sheet containing all 10 target QR codes
- Pure-domain tests for ad cadence, progression, finish state, and QR validation
- A starter PostgreSQL/Supabase schema for production
- Supabase auth: guest sign-in for hunters, email magic link for Hunt Masters,
  with a self-service `profiles` row created on first sign-in
- A server-authoritative write path for joining a hunt and confirming
  discoveries — `join_hunt`, `submit_scan`, and `my_current_items` in
  `supabase/schema.sql` — wired end to end into the app: when signed in with
  Supabase configured, joining, clue content, QR verification, and reward
  issuance all come from the server instead of local state

Without Supabase configured (or after choosing offline demo mode), the app
falls back to the original local-state flow with the seeded `Neon After Dark`
hunt, so the prototype still runs with zero credentials. Sponsor cards stay
local/demo content in both modes — there is no sponsor-fetching API yet. See
[`PRODUCT_BLUEPRINT.md`](./PRODUCT_BLUEPRINT.md) for the production design.

## Run it

Requirements:

- Node.js 20+
- Expo Go on an iOS or Android device, or an emulator with camera/location
  capability

```bash
npm install
npm run start
```

Then scan the Expo development QR code with a physical device. Camera, QR, GPS,
and AR preview flows are best tested on hardware.

### Optional: connect Supabase auth

Without configuration, the app runs entirely offline — the sign-in screen shows
a notice and a "Continue in offline demo mode" link. To turn on real auth:

1. Create a project at [supabase.com](https://supabase.com).
2. In the SQL editor, run [`supabase/schema.sql`](./supabase/schema.sql).
3. In **Authentication → Providers**, enable **Anonymous sign-ins** (used for
   the guest hunter flow) and confirm **Email** is on (used for the Hunt
   Master magic-link flow).
4. Copy `.env.example` to `.env` and fill in your project's URL and anon key
   (Project Settings → API). Both are safe to ship client-side; the anon key
   only grants what the RLS policies in `schema.sql` allow.
5. Restart `npm run start` so Expo picks up the new env vars.

Hunters can then sign in with just a display name; Hunt Masters sign in with
an email magic link so they can return to the same account across devices and
events. Sign-out and the current account are visible on the **Demo** tab.

Other commands:

```bash
npm run typecheck
npm test
npm run export:web
npm run qr:generate
```

The demo hunt code is:

```text
NIGHT-OWL
```

The QR print sheet is generated at:

```text
artifacts/clutrl-demo-qr-print-sheet.html
```

Open it in a browser and print at 100% scale. The app’s “Use the demo QR” button
lets the complete flow be tested from one device without the sheet.

## Prototype navigation

- **Hunt:** join or resume the hunt, reveal clues, scan targets, and claim the
  reward.
- **Master:** preview the organizer’s live team map, progress, help status, and
  operating tools.
- **Demo:** switch between Base, Live, and Immersive feature access or reset the
  hunt.

## Technical shape

- Expo SDK 57 / React Native 0.86
- TypeScript
- `expo-camera` for camera preview, capture, and QR recognition
- `expo-location` for foreground GPS
- Local state for the no-credential prototype
- Proposed production backend: Postgres, realtime channels, object storage,
  server-side QR verification, and push notifications

## Important production boundaries

1. The QR strings in this demo are readable, deterministic deep links. A live
   system must issue random, signed, expiring target tokens and verify them on
   the server.
2. The app requests only foreground location. Background tracking needs an
   explicit product decision, stronger disclosures, separate OS permissions,
   retention controls, and a development build.
3. The AR view proves the experience and capture flow, but accurate world-locked
   objects require ARKit location anchors and ARCore Geospatial anchors through
   native modules or an embedded AR engine.
4. The one-ad-before-first-clue, one-ad-per-find cadence should still not be
   connected to a programmatic interstitial network without policy review and
   user testing. Direct sponsor cards are the safer default.
5. The brand name is CLUTRL — CLUTRL.com and CLUTRL.FUN are owned. Full
   trademark clearance and app-store name availability have not been confirmed.
