import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createRng } from '@/domain/shared/rng';
import { PLAYERS } from '@/infrastructure/data/players';
import {
  AWAY_AFTER_MS,
  EMPTY_ROOM_TTL_MS,
  LOBBY_RECONNECT_GRACE_MS,
  REVEAL_STEP_MS,
  RoomService,
  TACTICS_MS,
} from './RoomService';
import { DEFAULT_MATCH_SETTINGS, type RoomSettings } from './types';
import { cleanSettings } from './validation';

const SETTINGS: RoomSettings = { ...DEFAULT_MATCH_SETTINGS, visibility: 'public', maxCoaches: 4 };
const A = 'token-aaaaaaaaaaaaaaaa';
const B = 'token-bbbbbbbbbbbbbbbb';
const C = 'token-cccccccccccccccc';

function setup() {
  let now = 1_000;
  const rng = createRng(1);
  const service = new RoomService({ players: PLAYERS, now: () => now, random: () => rng.next() });
  const advance = (ms: number, step = 250) => {
    for (let t = 0; t < ms; t += step) {
      now += step;
      service.tick();
    }
  };
  return { service, advance, clock: () => now };
}

function startMatch(service: RoomService, code: string) {
  service.setReady(code, B, true);
  const result = service.start(code, A);
  assert.ok(result.ok, JSON.stringify(result));
}

function createWithTwo(settings = SETTINGS) {
  const env = setup();
  const created = env.service.createRoom(A, 'Pedro', settings);
  assert.ok(created.ok);
  const code = created.code;
  assert.ok(env.service.joinRoom(code, B, 'Lucas').ok);
  return { ...env, code };
}

describe('rooms', () => {
  it('lists public rooms in the lobby but not private ones', () => {
    const { service } = setup();
    const pub = service.createRoom(A, 'Pedro', SETTINGS);
    service.createRoom(B, 'Lucas', { ...SETTINGS, visibility: 'private' });
    const list = service.publicRooms();
    assert.equal(list.length, 1);
    assert.equal(pub.ok && list[0].code, pub.ok && pub.code);
    assert.equal(list[0].hostName, 'Pedro');
  });

  it('rejects joins when full or already started, but lets members reconnect', () => {
    const { service, code } = createWithTwo({ ...SETTINGS, maxCoaches: 2 });
    const full = service.joinRoom(code, C, 'Gabi');
    assert.deepEqual(full, { ok: false, error: 'full' });

    startMatch(service, code);
    assert.deepEqual(service.joinRoom(code, C, 'Gabi'), { ok: false, error: 'started' });
    assert.ok(service.joinRoom(code, B, 'Lucas').ok, 'reconnect works after start');
  });

  it('only the host changes settings or starts, and settings cannot drop below members', () => {
    const { service, code } = createWithTwo();
    assert.deepEqual(service.updateSettings(code, B, SETTINGS), { ok: false, error: 'not_host' });
    assert.deepEqual(service.start(code, B), { ok: false, error: 'not_host' });
    assert.deepEqual(service.updateSettings(code, A, { ...SETTINGS, maxCoaches: 1 }), {
      ok: false,
      error: 'too_many_members',
    });
    assert.ok(service.updateSettings(code, A, { ...SETTINGS, visibility: 'private', maxCoaches: 6 }).ok);
    assert.equal(service.view(code, B)!.settings.maxCoaches, 6);
    assert.equal(service.publicRooms().length, 0);
  });

  it('needs at least two coaches to start', () => {
    const { service } = setup();
    const created = service.createRoom(A, 'Pedro', { ...SETTINGS, fillWithBots: false });
    assert.ok(created.ok);
    assert.deepEqual(service.start(created.code, A), { ok: false, error: 'not_enough_players' });
  });

  it('fills empty seats with bots and plays the whole match', () => {
    const { service, code, advance } = createWithTwo();
    startMatch(service, code);
    const view = service.view(code, A)!;
    assert.equal(view.auction!.coaches.length, 4);
    assert.equal(view.auction!.coaches.filter((c) => c.isBot).length, 2);
    assert.equal(view.members.find((m) => m.name === 'Pedro')!.coachId, 'coach-0');

    advance(20 * 60_000, 500);
    const end = service.view(code, A);
    assert.ok(end, 'room still exists');
    assert.equal(end.phase, 'tournament');
    assert.ok(end.tournament?.championId);
  });

  it('never sends the upcoming players or secrets to clients', () => {
    const { service, code } = createWithTwo();
    startMatch(service, code);
    const view = service.view(code, A)!;
    const json = JSON.stringify(view);
    assert.ok(!('queue' in view.auction!));
    assert.ok(!('rngSeed' in view.auction!), 'the seed would let someone predict the bots');
    assert.ok(!json.includes(A) && !json.includes(B), 'tokens are not leaked');
    assert.ok(view.auction!.queueLength > 0);
  });

  it('puts idle players in away mode and gives control back on activity', () => {
    const { service, code, advance } = createWithTwo();
    startMatch(service, code);
    advance(AWAY_AFTER_MS - 5_000);
    service.activity(code, B);
    advance(6_000);

    let view = service.view(code, A)!;
    assert.ok(view.members.find((m) => m.name === 'Pedro')!.away, 'idle player is away');
    assert.ok(!view.members.find((m) => m.name === 'Lucas')!.away, 'active player is not');
    assert.ok(view.auction!.coaches[0].isBot, 'a bot plays for the away player');

    service.activity(code, A);
    view = service.view(code, A)!;
    assert.ok(!view.members.find((m) => m.name === 'Pedro')!.away);
    assert.ok(!view.auction!.coaches[0].isBot);
  });

  it('a player who leaves mid-auction is replaced by a bot and the host moves on', () => {
    const { service, code } = createWithTwo();
    startMatch(service, code);
    assert.ok(service.leaveRoom(code, A).ok);
    const view = service.view(code, B)!;
    const pedro = view.members.find((m) => m.name === 'Pedro')!;
    assert.ok(pedro.left);
    assert.ok(view.members.find((m) => m.name === 'Lucas')!.isHost);
    const coach = view.auction!.coaches[0];
    assert.ok(coach.isBot && coach.replacedByBot);
  });

  it('disconnects become away during the auction and seats expire in the lobby', () => {
    const { service, code, advance } = createWithTwo();
    service.disconnect(code, B);
    advance(LOBBY_RECONNECT_GRACE_MS + 1_000);
    assert.equal(service.view(code, A)!.members.length, 1, 'dropped from the lobby');

    assert.ok(service.joinRoom(code, B, 'Lucas').ok);
    startMatch(service, code);
    service.disconnect(code, B);
    assert.ok(service.view(code, A)!.members.find((m) => m.name === 'Lucas')!.away);
  });

  it('deletes rooms that everyone abandoned', () => {
    const { service, code, advance } = createWithTwo();
    startMatch(service, code);
    service.disconnect(code, A);
    service.disconnect(code, B);
    advance(EMPTY_ROOM_TTL_MS + 1_000, 1_000);
    assert.equal(service.hasRoom(code), false);
  });

  it('the host can only start when everyone else is ready', () => {
    const { service, code } = createWithTwo();
    assert.deepEqual(service.start(code, A), { ok: false, error: 'not_ready' });
    service.setReady(code, B, true);
    assert.ok(service.view(code, A)!.members.every((m) => m.ready));
    service.updateSettings(code, A, { ...SETTINGS, bidSeconds: 20 });
    assert.ok(!service.view(code, A)!.members.find((m) => m.name === 'Lucas')!.ready, 'new rules reset ready');
    service.setReady(code, B, true);
    assert.ok(service.start(code, A).ok);
  });

  it('the host can kick someone, who cannot come back', () => {
    const { service, code } = createWithTwo();
    const lucas = service.view(code, A)!.members.find((m) => m.name === 'Lucas')!;
    assert.deepEqual(service.kick(code, B, lucas.id), { ok: false, error: 'not_host' });
    const kicked = service.kick(code, A, lucas.id);
    assert.ok(kicked.ok && kicked.kickedToken === B);
    assert.equal(service.view(code, B), null);
    assert.deepEqual(service.joinRoom(code, B, 'Lucas'), { ok: false, error: 'kicked' });
  });

  it('idle lobby players get marked ready, and an idle host starts the match', () => {
    const { service, code, advance } = createWithTwo();
    advance(AWAY_AFTER_MS - 5_000);
    service.activity(code, A);
    advance(6_000);
    let lucas = service.view(code, A)!.members.find((m) => m.name === 'Lucas')!;
    assert.ok(lucas.away && lucas.ready, 'idle guest is ready');
    assert.equal(service.view(code, A)!.phase, 'lobby', 'active host still decides');

    advance(AWAY_AFTER_MS);
    const view = service.view(code, A)!;
    assert.equal(view.phase, 'auction', 'away host started the match');
    lucas = view.members.find((m) => m.name === 'Lucas')!;
    assert.ok(lucas.away, 'away players start on autopilot');
  });

  it('after the auction everyone picks a tactic; choices stay secret', () => {
    const { service, code, advance } = createWithTwo();
    startMatch(service, code);
    for (let i = 0; i < 20_000 && service.view(code, A)!.phase === 'auction'; i++) {
      advance(500, 500);
      if (i % 20 === 0) {
        service.activity(code, A);
        service.activity(code, B);
      }
    }
    let view = service.view(code, A)!;
    assert.equal(view.phase, 'tactics');
    assert.ok(view.tactics && view.tactics.yours && !view.tactics.yours.confirmed);
    assert.deepEqual(Object.keys(view.tactics).sort(), ['confirmed', 'deadline', 'yours'], 'only your own tactic is sent');
    assert.equal(Object.values(view.tactics.confirmed).filter(Boolean).length, 2, 'bots confirmed right away');

    service.setTactic(code, A, { offense: 'threes', pace: 'fast' }, true);
    service.setTactic(code, B, { offense: 'nope', pace: 'fast' }, true);
    advance(500);
    assert.equal(service.view(code, A)!.phase, 'tactics', 'invalid tactic ignored, still waiting for Lucas');

    service.setTactic(code, B, { offense: 'paint', pace: 'slow' }, true);
    advance(500);
    view = service.view(code, A)!;
    assert.equal(view.phase, 'tournament');
    assert.deepEqual(view.tournament!.tactics['coach-0'], { offense: 'threes', pace: 'fast' });
  });

  it('the tactics phase ends on its own when time runs out', () => {
    const { service, code, advance } = createWithTwo();
    startMatch(service, code);
    advance(30 * 60_000, 1_000);
    assert.equal(service.view(code, A)!.phase, 'tournament');
    assert.ok(TACTICS_MS > 0);
  });

  it('everyone watches the competition together, one round at a time', () => {
    const { service, code, advance } = createWithTwo();
    startMatch(service, code);
    // Keep both players active until the competition starts.
    for (let i = 0; i < 20_000 && service.view(code, A)!.phase !== 'tournament'; i++) {
      advance(500, 500);
      if (i % 20 === 0) {
        service.activity(code, A);
        service.activity(code, B);
        if (service.view(code, A)!.phase === 'tactics') {
          service.setTactic(code, A, { offense: 'balanced', pace: 'normal' }, true);
          service.setTactic(code, B, { offense: 'balanced', pace: 'normal' }, true);
        }
      }
    }
    let reveal = service.view(code, A)!.reveal!;
    assert.equal(reveal.step, 0, 'starts on the auction results');
    assert.equal(reveal.total, 2);

    // Both ready: next round right away.
    service.setRevealReady(code, A, true);
    advance(250);
    assert.equal(service.view(code, A)!.reveal!.step, 0, 'still waiting for Lucas');
    assert.ok(service.view(code, A)!.reveal!.youReady);
    service.setRevealReady(code, B, true);
    advance(250);
    reveal = service.view(code, A)!.reveal!;
    assert.equal(reveal.step, 1);
    assert.ok(!reveal.youReady, 'ready resets every round');

    // The countdown only starts once the round's games have finished playing.
    let view = service.view(code, A)!;
    const playing = view.reveal!.playingUntil - view.serverNow;
    assert.ok(playing > 0, 'round 1 has live games to watch');
    assert.equal(view.reveal!.deadline! - view.reveal!.playingUntil, REVEAL_STEP_MS);
    service.setRevealReady(code, A, true);
    service.setRevealReady(code, B, true);
    advance(playing - 250, 250);
    assert.equal(service.view(code, A)!.reveal!.step, 1, 'nobody skips a game still being played');
    advance(500, 250);
    assert.equal(service.view(code, A)!.reveal!.step, 2, 'all ready once the games end: move on');

    // Nobody ready: the clock moves the room on, 10s after the games end.
    service.activity(code, A);
    service.activity(code, B);
    view = service.view(code, A)!;
    advance(view.reveal!.deadline! - view.serverNow - 1_000, 500);
    assert.equal(service.view(code, A)!.reveal!.step, 2);
    advance(1_500, 500);
    assert.equal(service.view(code, A)!.reveal!.step, 3);

    // An away player counts as ready: only Pedro has to click.
    advance(AWAY_AFTER_MS, 5_000);
    service.activity(code, A);
    view = service.view(code, A)!;
    const before = view.reveal!.step;
    advance(Math.max(0, view.reveal!.playingUntil - view.serverNow), 250);
    service.activity(code, A);
    service.setRevealReady(code, A, true);
    advance(250);
    assert.ok(service.view(code, A)!.members.find((m) => m.name === 'Lucas')!.away);
    assert.equal(service.view(code, A)!.reveal!.step, Math.min(before + 1, reveal.lastStep));

    // It stops on the awards.
    advance(REVEAL_STEP_MS * (reveal.lastStep + 2), 1_000);
    reveal = service.view(code, A)!.reveal!;
    assert.equal(reveal.step, reveal.lastStep);
    assert.equal(reveal.deadline, null);
  });

  it('validates settings sent by clients', () => {
    assert.ok(cleanSettings(SETTINGS));
    assert.equal(cleanSettings({ ...SETTINGS, maxCoaches: 40 }), null);
    assert.equal(cleanSettings({ ...SETTINGS, bidSeconds: 1 }), null);
    assert.equal(cleanSettings('hack'), null);
  });
});
