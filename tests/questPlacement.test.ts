import assert from 'node:assert/strict';
import test from 'node:test';
import {
  bearingDegrees,
  compassDirection,
  distanceMeters,
  randomPlacementWithin,
  resolveSlots,
} from '../src/lib/questPlacement';

// Encanto Sports Complex, roughly.
const VENUE = { latitude: 33.4864, longitude: -112.1065 };

test('generated placements always stay inside the vetted play area', () => {
  // This is the safety-critical property: the server rejects placements
  // outside the radius, but more importantly a target outside the venue is
  // a target on unvetted ground. Run it enough times to catch a bad
  // distribution rather than a single lucky draw.
  const radius = 150;
  for (let i = 0; i < 2000; i += 1) {
    const placement = randomPlacementWithin(VENUE, radius);
    const distance = distanceMeters(VENUE, placement);
    assert.ok(
      distance <= radius * 0.8 + 0.01,
      `placement ${i} was ${distance.toFixed(1)} m from centre, outside the 80% band`,
    );
  }
});

test('placements spread across the play area rather than clustering at the centre', () => {
  // sqrt() on the radius is what makes the distribution uniform over the
  // disc. Without it roughly 75% of points would fall inside half the
  // radius; uniform gives about 25%.
  const radius = 150;
  const usable = radius * 0.8;
  let insideHalf = 0;
  const samples = 4000;
  for (let i = 0; i < samples; i += 1) {
    if (distanceMeters(VENUE, randomPlacementWithin(VENUE, radius)) < usable / 2) {
      insideHalf += 1;
    }
  }
  const ratio = insideHalf / samples;
  assert.ok(
    ratio > 0.18 && ratio < 0.32,
    `expected ~0.25 of points inside half the radius, got ${ratio.toFixed(3)}`,
  );
});

test('bearing and compass direction agree on the cardinal points', () => {
  const north = { latitude: VENUE.latitude + 0.01, longitude: VENUE.longitude };
  const east = { latitude: VENUE.latitude, longitude: VENUE.longitude + 0.01 };
  const south = { latitude: VENUE.latitude - 0.01, longitude: VENUE.longitude };
  const west = { latitude: VENUE.latitude, longitude: VENUE.longitude - 0.01 };

  assert.equal(compassDirection(bearingDegrees(VENUE, north)), 'north');
  assert.equal(compassDirection(bearingDegrees(VENUE, east)), 'east');
  assert.equal(compassDirection(bearingDegrees(VENUE, south)), 'south');
  assert.equal(compassDirection(bearingDegrees(VENUE, west)), 'west');
});

test('compass wraps correctly either side of north', () => {
  assert.equal(compassDirection(359), 'north');
  assert.equal(compassDirection(1), 'north');
  assert.equal(compassDirection(315), 'northwest');
});

test('walking direction is omitted when the player position is unknown', () => {
  const placement = { latitude: VENUE.latitude + 0.0005, longitude: VENUE.longitude };
  const resolved = resolveSlots(['SAFE_WALKING_DIRECTION'], placement, null);
  assert.equal(resolved.SAFE_WALKING_DIRECTION, undefined);
});

test('walking direction states a real bearing and distance when position is known', () => {
  const placement = { latitude: VENUE.latitude + 0.0009, longitude: VENUE.longitude };
  const resolved = resolveSlots(['SAFE_WALKING_DIRECTION'], placement, VENUE);
  assert.match(resolved.SAFE_WALKING_DIRECTION!, /Head north, about \d+ m/);
});

test('standing on the target does not emit a nonsense one-metre instruction', () => {
  const placement = { latitude: VENUE.latitude + 0.00002, longitude: VENUE.longitude };
  const resolved = resolveSlots(['SAFE_WALKING_DIRECTION'], placement, VENUE);
  assert.match(resolved.SAFE_WALKING_DIRECTION!, /look around you/i);
});

test('unresolvable slots return look-for prompts, never invented landmarks', () => {
  const placement = randomPlacementWithin(VENUE, 150);
  const resolved = resolveSlots(
    ['LOCAL_LANDMARK', 'NEARBY_OPEN_SPACE', 'VISIBLE_SIGN_OR_COLOR', 'OBJECT_OR_SURFACE_TYPE'],
    placement,
    VENUE,
  );
  for (const value of Object.values(resolved)) {
    assert.ok(value && value.length > 0);
  }
  // The app does not know what is actually there, so the copy must ask the
  // player to look rather than assert a specific object exists.
  assert.match(resolved.LOCAL_LANDMARK!, /find|look|spot|pick/i);
});
