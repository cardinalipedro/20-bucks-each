/**
 * Socket.IO adapter for the room use cases. All game rules live in
 * application/rooms/RoomService.ts; this file only translates socket
 * messages into service calls and broadcasts the resulting views.
 */
import { createServer } from 'node:http';
import { Server, type Socket } from 'socket.io';
import type { RoomService } from '@/application/rooms/RoomService';
import type { Result } from '@/application/rooms/types';
import { cleanCode, cleanName, cleanSettings, cleanToken } from '@/application/rooms/validation';
import { CLIENT_EVENTS, SERVER_EVENTS } from '@/infrastructure/realtime/events';

const TICK_MS = 200;
const LOBBY_REFRESH_MS = 2000;
const LOBBY_CHANNEL = 'public-lobby';

export interface SocketServerOptions {
  service: RoomService;
  port: number;
  /** Allowed site origins, comma separated. */
  clientOrigin: string;
}

interface SocketData {
  token: string;
  code: string | null;
}

type Ack = (result: Result<object>) => void;

function safeAck(ack: unknown): Ack {
  return typeof ack === 'function' ? (ack as Ack) : () => {};
}

export function startSocketServer({ service, port, clientOrigin }: SocketServerOptions) {
  const httpServer = createServer((_req, res) => {
    // Health check for hosting platforms.
    res.writeHead(200, { 'content-type': 'text/plain' });
    res.end('20 Bucks Each server');
  });
  const io = new Server(httpServer, {
    cors: { origin: clientOrigin.split(',') },
  });

  async function broadcastRoom(code: string) {
    const sockets = await io.in(code).fetchSockets();
    for (const socket of sockets) {
      const data = socket.data as SocketData;
      const view = service.view(code, data.token);
      if (view) socket.emit(SERVER_EVENTS.roomState, view);
    }
  }

  function broadcastLobby() {
    io.to(LOBBY_CHANNEL).emit(SERVER_EVENTS.lobbyRooms, service.publicRooms());
  }

  io.on('connection', (socket: Socket) => {
    const token = cleanToken(socket.handshake.auth?.token);
    if (!token) {
      socket.disconnect(true);
      return;
    }
    const data = socket.data as SocketData;
    data.token = token;
    data.code = null;

    const enterRoom = (code: string) => {
      if (data.code && data.code !== code) socket.leave(data.code);
      data.code = code;
      socket.join(code);
    };

    socket.on(CLIENT_EVENTS.lobbySubscribe, () => {
      socket.join(LOBBY_CHANNEL);
      socket.emit(SERVER_EVENTS.lobbyRooms, service.publicRooms());
    });

    socket.on(CLIENT_EVENTS.lobbyUnsubscribe, () => {
      socket.leave(LOBBY_CHANNEL);
    });

    socket.on(CLIENT_EVENTS.roomCreate, (payload: { name?: unknown; settings?: unknown }, ack: unknown) => {
      const name = cleanName(payload?.name);
      const settings = cleanSettings(payload?.settings);
      if (!name || !settings) return safeAck(ack)({ ok: false, error: 'invalid' });

      const result = service.createRoom(token, name, settings);
      if (result.ok) {
        enterRoom(result.code);
        void broadcastRoom(result.code);
        broadcastLobby();
      }
      safeAck(ack)(result);
    });

    socket.on(CLIENT_EVENTS.roomJoin, (payload: { code?: unknown; name?: unknown }, ack: unknown) => {
      const code = cleanCode(payload?.code);
      const name = cleanName(payload?.name);
      if (!code || !name) return safeAck(ack)({ ok: false, error: 'invalid' });

      const result = service.joinRoom(code, token, name);
      if (result.ok) {
        enterRoom(code);
        void broadcastRoom(code);
        broadcastLobby();
      }
      safeAck(ack)(result);
    });

    socket.on(CLIENT_EVENTS.roomLeave, (ack: unknown) => {
      const code = data.code;
      if (!code) return safeAck(ack)({ ok: false, error: 'not_found' });
      const result = service.leaveRoom(code, token);
      socket.leave(code);
      data.code = null;
      void broadcastRoom(code);
      broadcastLobby();
      safeAck(ack)(result);
    });

    socket.on(CLIENT_EVENTS.roomSettings, (payload: { settings?: unknown }, ack: unknown) => {
      const settings = cleanSettings(payload?.settings);
      if (!data.code || !settings) return safeAck(ack)({ ok: false, error: 'invalid' });
      const result = service.updateSettings(data.code, token, settings);
      if (result.ok) {
        void broadcastRoom(data.code);
        broadcastLobby();
      }
      safeAck(ack)(result);
    });

    socket.on(CLIENT_EVENTS.roomStart, (ack: unknown) => {
      if (!data.code) return safeAck(ack)({ ok: false, error: 'not_found' });
      const result = service.start(data.code, token);
      if (result.ok) {
        void broadcastRoom(data.code);
        broadcastLobby();
      }
      safeAck(ack)(result);
    });

    socket.on(CLIENT_EVENTS.roomReady, (payload: { ready?: unknown }, ack: unknown) => {
      if (!data.code || typeof payload?.ready !== 'boolean') return safeAck(ack)({ ok: false, error: 'invalid' });
      const result = service.setReady(data.code, token, payload.ready);
      if (result.ok) void broadcastRoom(data.code);
      safeAck(ack)(result);
    });

    socket.on(CLIENT_EVENTS.roomKick, async (payload: { memberId?: unknown }, ack: unknown) => {
      const code = data.code;
      if (!code || typeof payload?.memberId !== 'string') return safeAck(ack)({ ok: false, error: 'invalid' });
      const result = service.kick(code, token, payload.memberId);
      if (!result.ok) return safeAck(ack)(result);

      // Tell every tab of the kicked player and take them out of the room channel.
      const sockets = await io.in(code).fetchSockets();
      for (const target of sockets) {
        const targetData = target.data as SocketData;
        if (targetData.token !== result.kickedToken) continue;
        target.emit(SERVER_EVENTS.kicked, { code });
        target.leave(code);
        targetData.code = null;
      }
      void broadcastRoom(code);
      safeAck(ack)({ ok: true });
    });

    socket.on(CLIENT_EVENTS.lineupSwap, (payload: { a?: unknown; b?: unknown }) => {
      if (!data.code) return;
      service.swapLineup(data.code, token, payload?.a, payload?.b);
      void broadcastRoom(data.code);
    });

    socket.on(CLIENT_EVENTS.tacticSet, (payload: { tactic?: unknown; confirmed?: unknown }) => {
      if (!data.code) return;
      service.setTactic(data.code, token, payload?.tactic, payload?.confirmed);
      void broadcastRoom(data.code);
    });

    socket.on(CLIENT_EVENTS.auctionBid, (payload: { amount?: unknown }) => {
      if (!data.code) return;
      service.bid(data.code, token, payload?.amount);
      void broadcastRoom(data.code);
    });

    socket.on(CLIENT_EVENTS.auctionPass, () => {
      if (!data.code) return;
      service.pass(data.code, token);
      void broadcastRoom(data.code);
    });

    socket.on(CLIENT_EVENTS.activity, () => {
      if (!data.code) return;
      service.activity(data.code, token);
      void broadcastRoom(data.code);
    });

    socket.on('disconnect', () => {
      if (!data.code) return;
      // Another tab of the same browser may still be connected to this room.
      void io
        .in(data.code)
        .fetchSockets()
        .then((sockets) => {
          const code = data.code!;
          if (sockets.some((s) => (s.data as SocketData).token === token)) return;
          service.disconnect(code, token);
          void broadcastRoom(code);
          broadcastLobby();
        });
    });
  });

  setInterval(() => {
    for (const code of service.tick()) void broadcastRoom(code);
  }, TICK_MS);

  // Rooms can also disappear or open seats on their own (timeouts), so the
  // public list is re-sent whenever it changes.
  let lastLobby = '';
  setInterval(() => {
    const current = JSON.stringify(service.publicRooms());
    if (current !== lastLobby) {
      lastLobby = current;
      broadcastLobby();
    }
  }, LOBBY_REFRESH_MS);

  httpServer.listen(port, () => {
    console.log(`20 Bucks Each server listening on http://localhost:${port} (client: ${clientOrigin})`);
  });

  return { io, httpServer };
}
