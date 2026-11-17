import { PLAYERS } from '../../data/players';
import { createAuction, passLot, placeBid, replaceWithBot, setAutopilot, tick } from '../auction/engine';
import type { AuctionState } from '../auction/types';
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
} from './types';

/** No input for this long during the auction puts a player in away mode. */
export const AWAY_AFTER_MS = 45_000;
/** A player who drops in the lobby keeps their seat for this long. */
export const LOBBY_RECONNECT_GRACE_MS = 30_000;
/** Rooms where nobody is connected are deleted after this long. */
export const EMPTY_ROOM_TTL_MS = 5 * 60_000;

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
  tournament: Tournament | null;
  emptySince: number | null;
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
      tournament: null,
      emptySince: null,
    });
    return { ok: true, code };
  }

  /** Joins a room, or reconnects if this browser is already a member. */
  joinRoom(code: string, token: string, name: string): Result<{ memberId: string }> {
    const room = this.rooms.get(code);
    if (!room) return { ok: false, error: 'not_found' };

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

  updateSettings(code: string, token: string, settings: RoomSettings): Result<object> {
    const room = this.rooms.get(code);
    if (!room) return { ok: false, error: 'not_found' };
    if (!this.isHost(room, token)) return { ok: false, error: 'not_host' };
    if (room.phase !== 'lobby') return { ok: false, error: 'started' };
    if (settings.maxCoaches < this.activeMembers(room).length) return { ok: false, error: 'too_many_members' };
    room.settings = settings;
    return { ok: true };
  }

  start(code: string, token: string): Result<object> {
    const room = this.rooms.get(code);
    if (!room) return { ok: false, error: 'not_found' };
    if (!this.isHost(room, token)) return { ok: false, error: 'not_host' };
    if (room.phase !== 'lobby') return { ok: false, error: 'started' };

    const humans = this.activeMembers(room);
    const total = room.settings.fillWithBots ? room.settings.maxCoaches : humans.length;
    if (total < MIN_COACHES) return { ok: false, error: 'not_enough_players' };

    const now = this.deps.now();
    humans.forEach((member, index) => {
      member.coachId = `coach-${index}`;
      member.lastActivity = now;
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
    // Anyone already disconnected starts on autopilot.
    for (const member of humans) {
      if (!member.connected) room.auction = setAutopilot(room.auction, member.coachId!, true, now);
    }
    room.phase = 'auction';
    return { ok: true };
  }

  // -------------------------------------------------------------------------
  // Auction actions
  // -------------------------------------------------------------------------

  bid(code: string, token: string, amount: unknown) {
    const found = this.playing(code, token);
    if (!found || typeof amount !== 'number' || !Number.isInteger(amount)) return;
    this.markActive(found.room, found.member);
    found.room.auction = placeBid(found.room.auction!, found.member.coachId!, amount, this.deps.now());
  }

  pass(code: string, token: string) {
    const found = this.playing(code, token);
    if (!found) return;
    this.markActive(found.room, found.member);
    found.room.auction = passLot(found.room.auction!, found.member.coachId!, this.deps.now());
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
      if (room.phase !== 'auction' || !room.auction) continue;

      const before = room.auction;
      let auction = tick(before, now);

      for (const member of room.members) {
        const idle = now - member.lastActivity > AWAY_AFTER_MS;
        if (member.coachId && !member.left && member.connected && idle) {
          auction = setAutopilot(auction, member.coachId, true, now);
        }
      }

      room.auction = auction;
      if (auction.phase === 'finished') {
        room.tournament = simulateTournament({
          coaches: auction.coaches,
          players: auction.players,
          settings: room.settings.tournament,
          seed: auction.rngSeed,
        });
        room.phase = 'tournament';
      }
      if (auction !== before) changed.push(room.code);
    }
    return changed;
  }

  // -------------------------------------------------------------------------
  // Views
  // -------------------------------------------------------------------------

  view(code: string, token: string): RoomView | null {
    const room = this.rooms.get(code);
    const you = room?.members.find((m) => m.token === token);
    if (!room || !you) return null;

    const members: MemberView[] = room.members.map((m) => ({
      id: m.id,
      name: m.name,
      isHost: m.id === room.hostId,
      connected: m.connected,
      away: !!(m.coachId && room.auction?.coaches.find((c) => c.id === m.coachId)?.away),
      left: m.left,
      coachId: m.coachId,
    }));

    return {
      code: room.code,
      phase: room.phase,
      settings: room.settings,
      members,
      youId: you.id,
      auction: room.auction ? toAuctionView(room.auction) : null,
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

  private playing(code: string, token: string) {
    const room = this.rooms.get(code);
    const member = room?.members.find((m) => m.token === token && !m.left);
    if (!room || !member || room.phase !== 'auction' || !room.auction || !member.coachId) return null;
    return { room, member };
  }

  private markActive(room: Room, member: Member) {
    member.lastActivity = this.deps.now();
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
