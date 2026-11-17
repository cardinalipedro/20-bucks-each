/** Socket event names shared by the server and the client. */

export const CLIENT_EVENTS = {
  lobbySubscribe: 'lobby:subscribe',
  lobbyUnsubscribe: 'lobby:unsubscribe',
  roomCreate: 'room:create',
  roomJoin: 'room:join',
  roomLeave: 'room:leave',
  roomSettings: 'room:settings',
  roomStart: 'room:start',
  auctionBid: 'auction:bid',
  auctionPass: 'auction:pass',
  activity: 'presence:activity',
} as const;

export const SERVER_EVENTS = {
  roomState: 'room:state',
  lobbyRooms: 'lobby:rooms',
} as const;
