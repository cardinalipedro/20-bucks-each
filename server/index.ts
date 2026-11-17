/**
 * Composition root of the room server: wires the real clock, random source
 * and player database into the use cases, then starts the Socket.IO adapter.
 *
 * Run with `npm run dev` (together with the site) or `npm run dev:server`.
 */
import { RoomService } from '@/application/rooms/RoomService';
import { PLAYERS } from '@/infrastructure/data/players';
import { startSocketServer } from '@/infrastructure/server/socketServer';

const service = new RoomService({ players: PLAYERS, now: Date.now, random: Math.random });

startSocketServer({
  service,
  port: Number(process.env.PORT ?? 3001),
  clientOrigin: process.env.CLIENT_ORIGIN ?? 'http://localhost:3000',
});
