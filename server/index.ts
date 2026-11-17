/**
 * Real-time server for rooms (Socket.IO). All game rules live in
 * src/lib/rooms/service.ts; this file only moves messages around.
 *
 * Run with `npm run dev` (together with the site) or `npm run dev:server`.
 */
import { createServer } from 'node:http';
import { Server, type Socket } from 'socket.io';
import { RoomService } from '../src/lib/rooms/service';
import type { Result } from '../src/lib/rooms/types';
import { cleanCode, cleanName, cleanSettings, cleanToken } from '../src/lib/rooms/validate';
import { CLIENT_EVENTS, SERVER_EVENTS } from '../src/lib/rooms/events';

const PORT = Number(process.env.PORT ?? 3001);
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN ?? 'http://localhost:3000';
const TICK_MS = 200;
const LOBBY_REFRESH_MS = 2000;
const LOBBY_CHANNEL = 'public-lobby';

const service = new RoomService();
const httpServer = createServer((_req, res) => {
  // Health check for hosting platforms.
  res.writeHead(200, { 'content-type': 'text/plain' });
  res.end('20 Bucks Each server');
});
const io = new Server(httpServer, {
  cors: { origin: CLIENT_ORIGIN.split(',') },
});

interface SocketData {
  token: string;
  code: string | null;
}

type Ack = (result: Result<object> | (Result<object> & Record<string, unknown>)) => void;

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

function safeAck(ack: unknown): Ack {
  return typeof ack === 'function' ? (ack as Ack) : () => {};
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

httpServer.listen(PORT, () => {
  console.log(`20 Bucks Each server listening on http://localhost:${PORT} (client: ${CLIENT_ORIGIN})`);
});
