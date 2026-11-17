import { PLAYERS } from '../../data/players';
import { createAuction, passLot, placeBid, replaceWithBot, setAutopilot, tick } from '../auction/engine';
import { swapLineup } from '../auction/lineup';
import type { AuctionState } from '../auction/types';
import { bestTactic, DEFAULT_TACTIC, isTactic, teamProfile } from '../sim/tactics';
import { simulateTournament } from '../sim/tournament';
import type { Tournament } from '../sim/types';
import {
  MIN_COACHES,
  type AuctionView,
  type MemberView,
  type PublicRoomSummary,
  type Result,
  type RoomPhase,
  type RoomSettings,
  type RoomView,
  type TacticChoice,
} from './types';

/** No input for this long puts a player in away mode (lobby, auction and tactics). */
export const AWAY_AFTER_MS = 45_000;
/** A player who drops in the lobby keeps their seat for this long. */
export const LOBBY_RECONNECT_GRACE_MS = 30_000;
/** Rooms where nobody is connected are deleted after this long. */
export const EMPTY_ROOM_TTL_MS = 5 * 60_000;
/** Time everyone gets to pick a tactic after the auction. */
export const TACTICS_MS = 60_000;

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 5;

interface Member {
  id: string;
  /** Secret that identifies the browser; never sent to other players. */
  token: string;
  name: string;
  connected: boolean;
  disconnectedAt: number | null;
  lastActivity: number;
  ready: boolean;
  /** Idle in the lobby: a bot marked them ready (and starts the match if they host). */
  lobbyAway: boolean;
  coachId: string | null;
  left: boolean;
}

interface Room {
  code: string;
  settings: RoomSettings;
  members: Member[];
  hostId: string;
  phase: RoomPhase;
  auction: AuctionState | null;
  tactics: Record<string, TacticChoice> | null;
  tacticsDeadline: number | null;
  tournament: Tournament | null;
  emptySince: number | null;
  /** Tokens kicked by the host: they cannot come back. */
  banned: Set<string>;
}

interface Deps {
  now: () => number;
  random: () => number;
}

/**
 * All room logic, with no networking: the Socket.IO server calls these methods
 * and broadcasts the result. Keeping it pure makes it easy to test.
 */
export class RoomService {
  private rooms = new Map<string, Room>();
  private memberSeq = 0;

  constructor(private deps: Deps = { now: Date.now, random: Math.random }) {}

  // -------------------------------------------------------------------------
  // Lobby
  // -------------------------------------------------------------------------

  createRoom(token: string, name: string, settings: RoomSettings): Result<{ code: string }> {
    const code = this.newCode();
    const member = this.newMember(token, name);
    this.rooms.set(code, {
      code,
      settings,
      members: [member],
      hostId: member.id,
      phase: 'lobby',
      auction: null,
      tactics: null,
      tacticsDeadline: null,
      tournament: null,
      emptySince: null,
      banned: new Set(),
    });
    return { ok: true, code };
  }

  /** Joins a room, or reconnects if this browser is already a member. */
  joinRoom(code: string, token: string, name: string): Result<{ memberId: string }> {
    const room = this.rooms.get(code);
    if (!room) return { ok: false, error: 'not_found' };
    if (room.banned.has(token)) return { ok: false, error: 'kicked' };

    const existing = room.members.find((m) => m.token === token);
    if (existing && !existing.left) {
      existing.connected = true;
      existing.disconnectedAt = null;
      if (room.phase === 'lobby') existing.name = name;
      room.emptySince = null;
      return { ok: true, memberId: existing.id };
    }

    if (room.phase !== 'lobby') return { ok: false, error: 'started' };
    if (this.activeMembers(room).length >= room.settings.maxCoaches) return { ok: false, error: 'full' };

    const member = this.newMember(token, name);
    room.members.push(member);
    room.emptySince = null;
    return { ok: true, memberId: member.id };
  }

  leaveRoom(code: string, token: string): Result<object> {
    const room = this.rooms.get(code);
    const member = room?.members.find((m) => m.token === token && !m.left);
    if (!room || !member) return { ok: false, error: 'not_found' };

    if (room.phase === 'lobby') {
      room.members = room.members.filter((m) => m !== member);
    } else {
      member.left = true;
      member.connected = false;
      if (room.auction && member.coachId) room.auction = replaceWithBot(room.auction, member.coachId, this.deps.now());
    }
    this.afterMemberGone(room, member);
    return { ok: true };
  }

  /** Socket dropped: keep the seat for a while, and let a bot play meanwhile. */
  disconnect(code: string, token: string) {
    const room = this.rooms.get(code);
    const member = room?.members.find((m) => m.token === token && !m.left);
    if (!room || !member) return;
    member.connected = false;
    member.disconnectedAt = this.deps.now();
    if (room.auction && member.coachId) {
      room.auction = setAutopilot(room.auction, member.coachId, true, this.deps.now());
    }
    this.afterMemberGone(room, member);
  }

  setReady(code: string, token: string, ready: boolean): Result<object> {
    const room = this.rooms.get(code);
    const member = room?.members.find((m) => m.token === token && !m.left);
    if (!room || !member) return { ok: false, error: 'not_found' };
    if (room.phase !== 'lobby') return { ok: false, error: 'started' };
    this.markActive(room, member);
    member.ready = ready;
    return { ok: true };
  }

  /** Host removes someone from the lobby. Returns the kicked token so the server can disconnect it. */
  kick(code: string, token: string, memberId: string): Result<{ kickedToken: string }> {
    const room = this.rooms.get(code);
    if (!room) return { ok: false, error: 'not_found' };
    if (!this.isHost(room, token)) return { ok: false, error: 'not_host' };
    if (room.phase !== 'lobby') return { ok: false, error: 'started' };

    const target = room.members.find((m) => m.id === memberId);
    if (!target || target.id === room.hostId) return { ok: false, error: 'invalid' };
    room.members = room.members.filter((m) => m !== target);
    room.banned.add(target.token);
    return { ok: true, kickedToken: target.token };
  }

  updateSettings(code: string, token: string, settings: RoomSettings): Result<object> {
    const room = this.rooms.get(code);
    if (!room) return { ok: false, error: 'not_found' };
    if (!this.isHost(room, token)) return { ok: false, error: 'not_host' };
    if (room.phase !== 'lobby') return { ok: false, error: 'started' };
    if (settings.maxCoaches < this.activeMembers(room).length) return { ok: false, error: 'too_many_members' };
    room.settings = settings;
    // The rules changed: everyone confirms again.
    for (const member of room.members) {
      if (member.id !== room.hostId) member.ready = false;
    }
    this.markActive(room, room.members.find((m) => m.id === room.hostId)!);
    return { ok: true };
  }

  start(code: string, token: string): Result<object> {
    const room = this.rooms.get(code);
    if (!room) return { ok: false, error: 'not_found' };
    if (!this.isHost(room, token)) return { ok: false, error: 'not_host' };
    if (room.phase !== 'lobby') return { ok: false, error: 'started' };
    const check = this.canStart(room);
    if (!check.ok) return check;
    this.launch(room);
    return { ok: true };
  }

  // -------------------------------------------------------------------------
  // Match actions
  // -------------------------------------------------------------------------

  bid(code: string, token: string, amount: unknown) {
    const found = this.playing(code, token, 'auction');
    if (!found || typeof amount !== 'number' || !Number.isInteger(amount)) return;
    this.markActive(found.room, found.member);
    found.room.auction = placeBid(found.room.auction!, found.member.coachId!, amount, this.deps.now());
  }

  pass(code: string, token: string) {
    const found = this.playing(code, token, 'auction');
    if (!found) return;
    this.markActive(found.room, found.member);
    found.room.auction = passLot(found.room.auction!, found.member.coachId!, this.deps.now());
  }

  setTactic(code: string, token: string, tactic: unknown, confirmed: unknown) {
    const found = this.playing(code, token, 'tactics');
    if (!found || !isTactic(tactic) || typeof confirmed !== 'boolean') return;
    this.markActive(found.room, found.member);
    found.room.tactics![found.member.coachId!] = { tactic, confirmed };
  }

  /** Moves players between roster slots during the tactics phase. */
  swapLineup(code: string, token: string, a: unknown, b: unknown) {
    const found = this.playing(code, token, 'tactics');
    if (!found) return;
    this.markActive(found.room, found.member);
    found.room.auction = swapLineup(found.room.auction!, found.member.coachId!, a, b);
  }

  /** Any input from the player: resets the idle timer and ends away mode. */
  activity(code: string, token: string) {
    const room = this.rooms.get(code);
    const member = room?.members.find((m) => m.token === token && !m.left);
    if (!room || !member) return;
    this.markActive(room, member);
  }

  // -------------------------------------------------------------------------
  // Clock
  // -------------------------------------------------------------------------

  /** Advances every room. Returns the codes of rooms whose view changed. */
  tick(): string[] {
    const now = this.deps.now();
    const changed: string[] = [];

    for (const room of [...this.rooms.values()]) {
      if (this.cleanup(room, now)) continue;
      let updated = false;
      if (room.phase === 'lobby') updated = this.tickLobby(room, now);
      else if (room.phase === 'auction') updated = this.tickAuction(room, now);
      else if (room.phase === 'tactics') updated = this.tickTactics(room, now);
      if (updated) changed.push(room.code);
    }
    return changed;
  }

  private tickLobby(room: Room, now: number): boolean {
    let changed = false;
    for (const member of this.activeMembers(room)) {
      if (member.connected && !member.lobbyAway && now - member.lastActivity > AWAY_AFTER_MS) {
        member.lobbyAway = true;
        member.ready = true;
        changed = true;
      }
    }

    // An away host should not hold everyone hostage: once all the others are ready, start.
    const host = room.members.find((m) => m.id === room.hostId);
    const others = this.activeMembers(room).filter((m) => m.id !== room.hostId);
    if (host?.lobbyAway && others.length > 0 && this.canStart(room).ok) {
      this.launch(room);
      changed = true;
    }
    return changed;
  }

  private tickAuction(room: Room, now: number): boolean {
    const before = room.auction!;
    const auction = this.applyIdleAutopilot(room, tick(before, now), now);
    room.auction = auction;
    if (auction.phase === 'finished') this.enterTactics(room, now);
    return auction !== before;
  }

  private tickTactics(room: Room, now: number): boolean {
    const before = room.auction!;
    const auction = this.applyIdleAutopilot(room, before, now);
    room.auction = auction;
    const tactics = room.tactics!;
    let changed = auction !== before;

    // Bots, and humans who are away, go with the tactic that fits their roster.
    for (const coach of auction.coaches) {
      if (coach.isBot && !tactics[coach.id].confirmed) {
        tactics[coach.id] = { tactic: bestTactic(teamProfile(coach, auction.players)), confirmed: true };
        changed = true;
      }
    }

    const allConfirmed = Object.values(tactics).every((choice) => choice.confirmed);
    if (allConfirmed || now >= room.tacticsDeadline!) {
      room.tournament = simulateTournament({
        coaches: auction.coaches,
        players: auction.players,
        settings: room.settings.tournament,
        seed: auction.rngSeed,
        tactics: Object.fromEntries(Object.entries(tactics).map(([id, choice]) => [id, choice.tactic])),
      });
      room.phase = 'tournament';
      changed = true;
    }
    return changed;
  }

  private applyIdleAutopilot(room: Room, auction: AuctionState, now: number): AuctionState {
    let next = auction;
    for (const member of room.members) {
      const idle = now - member.lastActivity > AWAY_AFTER_MS;
      if (member.coachId && !member.left && member.connected && idle) {
        next = setAutopilot(next, member.coachId, true, now);
      }
    }
    return next;
  }

  private enterTactics(room: Room, now: number) {
    const auction = room.auction!;
    room.tactics = Object.fromEntries(
      auction.coaches.map((coach) => [
        coach.id,
        coach.isBot
          ? { tactic: bestTactic(teamProfile(coach, auction.players)), confirmed: true }
          : { tactic: DEFAULT_TACTIC, confirmed: false },
      ]),
    );
    room.tacticsDeadline = now + TACTICS_MS;
    room.phase = 'tactics';
  }

  // -------------------------------------------------------------------------
  // Views
  // -------------------------------------------------------------------------

  view(code: string, token: string): RoomView | null {
    const room = this.rooms.get(code);
    const you = room?.members.find((m) => m.token === token);
    if (!room || !you) return null;

    const coachAway = (coachId: string | null) =>
      !!(coachId && room.auction?.coaches.find((c) => c.id === coachId)?.away);

    const members: MemberView[] = room.members.map((m) => ({
      id: m.id,
      name: m.name,
      isHost: m.id === room.hostId,
      connected: m.connected,
      away: room.phase === 'lobby' ? m.lobbyAway : coachAway(m.coachId),
      ready: m.id === room.hostId || m.ready,
      left: m.left,
      coachId: m.coachId,
    }));

    const tactics = room.phase === 'tactics' ? room.tactics : null;
    return {
      code: room.code,
      phase: room.phase,
      settings: room.settings,
      members,
      youId: you.id,
      auction: room.auction ? toAuctionView(room.auction) : null,
      tactics: tactics
        ? {
            deadline: room.tacticsDeadline!,
            yours: you.coachId ? tactics[you.coachId] : null,
            // Other coaches' choices stay secret until the games are played.
            confirmed: Object.fromEntries(Object.entries(tactics).map(([id, choice]) => [id, choice.confirmed])),
          }
        : null,
      tournament: room.tournament,
      serverNow: this.deps.now(),
    };
  }

  publicRooms(): PublicRoomSummary[] {
    return [...this.rooms.values()]
      .filter((room) => room.phase === 'lobby' && room.settings.visibility === 'public')
      .filter((room) => this.activeMembers(room).length < room.settings.maxCoaches)
      .map((room) => ({
        code: room.code,
        hostName: room.members.find((m) => m.id === room.hostId)?.name ?? '?',
        members: this.activeMembers(room).length,
        maxCoaches: room.settings.maxCoaches,
        format: room.settings.tournament.format,
        benchSize: room.settings.benchSize,
      }));
  }

  hasRoom(code: string): boolean {
    return this.rooms.has(code);
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private canStart(room: Room): Result<object> {
    const humans = this.activeMembers(room);
    const total = room.settings.fillWithBots ? room.settings.maxCoaches : humans.length;
    if (total < MIN_COACHES) return { ok: false, error: 'not_enough_players' };
    if (humans.some((m) => m.id !== room.hostId && !m.ready)) return { ok: false, error: 'not_ready' };
    return { ok: true };
  }

  private launch(room: Room) {
    const humans = this.activeMembers(room);
    const total = room.settings.fillWithBots ? room.settings.maxCoaches : humans.length;
    const now = this.deps.now();

    humans.forEach((member, index) => {
      member.coachId = `coach-${index}`;
    });
    room.auction = createAuction({
      settings: { startingCash: 20, benchSize: room.settings.benchSize, bidSeconds: room.settings.bidSeconds },
      players: PLAYERS,
      coaches: [
        ...humans.map((member) => ({ name: member.name, isBot: false })),
        ...Array.from({ length: total - humans.length }, (_, i) => ({ name: `Bot ${i + 1}`, isBot: true })),
      ],
      seed: Math.floor(this.deps.random() * 2 ** 31),
      now,
    });
    // Anyone disconnected or away in the lobby starts on autopilot.
    for (const member of humans) {
      if (!member.connected || member.lobbyAway) {
        room.auction = setAutopilot(room.auction, member.coachId!, true, now);
      } else {
        member.lastActivity = now;
      }
    }
    room.phase = 'auction';
  }

  private newCode(): string {
    for (;;) {
      const code = Array.from(
        { length: CODE_LENGTH },
        () => CODE_ALPHABET[Math.floor(this.deps.random() * CODE_ALPHABET.length)],
      ).join('');
      if (!this.rooms.has(code)) return code;
    }
  }

  private newMember(token: string, name: string): Member {
    this.memberSeq += 1;
    return {
      id: `m${this.memberSeq}`,
      token,
      name,
      connected: true,
      disconnectedAt: null,
      lastActivity: this.deps.now(),
      ready: false,
      lobbyAway: false,
      coachId: null,
      left: false,
    };
  }

  private activeMembers(room: Room): Member[] {
    return room.members.filter((m) => !m.left);
  }

  private isHost(room: Room, token: string): boolean {
    return room.members.find((m) => m.token === token)?.id === room.hostId;
  }

  private playing(code: string, token: string, phase: RoomPhase) {
    const room = this.rooms.get(code);
    const member = room?.members.find((m) => m.token === token && !m.left);
    if (!room || !member || room.phase !== phase || !room.auction || !member.coachId) return null;
    return { room, member };
  }

  private markActive(room: Room, member: Member) {
    member.lastActivity = this.deps.now();
    member.lobbyAway = false;
    if (room.auction && member.coachId && member.connected) {
      room.auction = setAutopilot(room.auction, member.coachId, false, this.deps.now());
    }
  }

  /** Passes the host role on and deletes the room when nobody is left. */
  private afterMemberGone(room: Room, member: Member) {
    const active = this.activeMembers(room);
    if (active.length === 0) {
      this.rooms.delete(room.code);
      return;
    }
    const stillHere = room.members.includes(member) && !member.left;
    if (room.hostId === member.id && !stillHere) {
      room.hostId = (active.find((m) => m.connected) ?? active[0]).id;
    }
    if (!active.some((m) => m.connected)) room.emptySince = room.emptySince ?? this.deps.now();
  }

  /** Drops lobby members who did not come back, and deletes abandoned rooms. Returns true if deleted. */
  private cleanup(room: Room, now: number): boolean {
    if (room.phase === 'lobby') {
      const expired = room.members.filter(
        (m) => !m.connected && m.disconnectedAt !== null && now - m.disconnectedAt > LOBBY_RECONNECT_GRACE_MS,
      );
      for (const member of expired) {
        room.members = room.members.filter((m) => m !== member);
        this.afterMemberGone(room, member);
        if (!this.rooms.has(room.code)) return true;
      }
    }
    if (room.emptySince !== null && now - room.emptySince > EMPTY_ROOM_TTL_MS) {
      this.rooms.delete(room.code);
      return true;
    }
    return false;
  }
}

function toAuctionView(state: AuctionState): AuctionView {
  return {
    settings: state.settings,
    coaches: state.coaches,
    lot: state.lot,
    unsold: state.unsold,
    history: state.history,
    phase: state.phase,
    lotNumber: state.lotNumber,
    queueLength: state.queue.length,
  };
}
