// ============================================================================
// Chakri — Court Piece card game, 6-player variant
// celld Worker + GameRoom Durable Object
// ============================================================================

const SUITS = ["hearts", "diamonds", "clubs", "spades"];
const RANKS = ["A", "K", "Q", "J", "10", "9", "8", "7", "6", "5", "4", "3"];
const RANK_VALUES = Object.fromEntries(RANKS.map((r, i) => [r, RANKS.length - i]));
const NUM_PLAYERS = 6;
const CARDS_PER_PLAYER = 8;
const TOTAL_TRICKS = CARDS_PER_PLAYER;

// ---------------------------------------------------------------------------
// Deck helpers
// ---------------------------------------------------------------------------
function buildDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ suit, rank, id: `${rank}-${suit}` });
    }
  }
  return deck; // 48 cards (no 2s)
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function deal() {
  const deck = shuffle(buildDeck());
  const hands = [];
  for (let p = 0; p < NUM_PLAYERS; p++) {
    hands.push(deck.slice(p * CARDS_PER_PLAYER, (p + 1) * CARDS_PER_PLAYER));
  }
  return hands;
}

function cardBeats(card, against, ledSuit, trumpSuit) {
  if (card.suit === trumpSuit && against.suit !== trumpSuit) return true;
  if (card.suit !== trumpSuit && against.suit === trumpSuit) return false;
  if (card.suit === against.suit) {
    return RANK_VALUES[card.rank] > RANK_VALUES[against.rank];
  }
  // Different non-trump suits: only led suit can win
  if (card.suit === ledSuit && against.suit !== ledSuit) return true;
  if (card.suit !== ledSuit && against.suit === ledSuit) return false;
  return false; // neither followed led suit, neither trumped
}

function trickWinner(trick, trumpSuit) {
  const ledSuit = trick[0].card.suit;
  let best = trick[0];
  for (let i = 1; i < trick.length; i++) {
    if (cardBeats(trick[i].card, best.card, ledSuit, trumpSuit)) {
      best = trick[i];
    }
  }
  return best.playerIndex;
}

// ---------------------------------------------------------------------------
// RoomRegistry Durable Object — tracks all room IDs for admin listing
// ---------------------------------------------------------------------------
export class RoomRegistry {
  constructor(state, env) { this.state = state; this.env = env; }

  async fetch(request) {
    const url = new URL(request.url);

    // Register a room
    if (url.pathname === "/register" && request.method === "POST") {
      const { roomId } = await request.json();
      const rooms = (await this.state.storage.get("rooms")) || [];
      if (!rooms.includes(roomId)) {
        rooms.push(roomId);
        await this.state.storage.put("rooms", rooms);
      }
      return new Response("ok", { status: 200 });
    }

    // List all rooms
    if (url.pathname === "/list") {
      const rooms = (await this.state.storage.get("rooms")) || [];
      return new Response(JSON.stringify({ rooms }), {
        status: 200, headers: { "Content-Type": "application/json" },
      });
    }

    // Unregister a room
    if (url.pathname === "/unregister" && request.method === "POST") {
      const { roomId } = await request.json();
      let rooms = (await this.state.storage.get("rooms")) || [];
      rooms = rooms.filter(r => r !== roomId);
      await this.state.storage.put("rooms", rooms);
      return new Response("ok", { status: 200 });
    }

    return new Response("not found", { status: 404 });
  }
}

// ---------------------------------------------------------------------------
// GameRoom Durable Object
// ---------------------------------------------------------------------------
export class GameRoom {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.sessions = new Map(); // playerIndex -> WebSocket
  }

  // --- Storage helpers ---
  async getState() {
    return (await this.state.storage.get("game")) || null;
  }
  async setState(game) {
    await this.state.storage.put("game", game);
  }

  // --- WebSocket lifecycle ---
  async fetch(request) {
    const url = new URL(request.url);

    // Health check
    if (url.pathname === "/health") {
      return new Response("ok", { status: 200 });
    }

    // Kill room: DELETE /kill — wipes storage and closes all connections
    if (url.pathname === "/kill" || (request.method === "DELETE" && url.pathname === "/")) {
      // Close all WebSocket sessions
      for (const [idx, ws] of this.sessions) {
        try {
          ws.send(JSON.stringify({ type: "kicked", message: "Room has been deleted by admin" }));
          ws.close(1000, "Room deleted");
        } catch {}
      }
      this.sessions.clear();
      // Wipe all storage
      await this.state.storage.deleteAll();
      return new Response(JSON.stringify({ killed: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Get room info (for admin listing)
    if (url.pathname === "/info") {
      const game = await this.getState();
      return new Response(JSON.stringify({
        exists: !!game,
        phase: game?.phase || null,
        players: game?.players?.map(p => ({ name: p.name, connected: p.connected, team: p.team })) || [],
        handNumber: game?.handNumber || 0,
        scores: game?.scores || [0, 0],
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return new Response("websocket upgrade required", { status: 426 });
    }

    const pair = new WebSocketPair();
    const server = pair[0];

    // Parse player info from query string
    const playerName = url.searchParams.get("name") || "Player";
    const playerId = url.searchParams.get("pid") || crypto.randomUUID();

    server.playerName = playerName;
    server.playerId = playerId;

    this.state.acceptWebSocket(server);
    return new Response(null, { status: 101, webSocket: pair[1] });
  }

  async webSocketMessage(ws, msg) {
    let data;
    try {
      data = JSON.parse(msg);
    } catch {
      ws.send(JSON.stringify({ type: "error", message: "invalid JSON" }));
      return;
    }

    const game = await this.getState();

    switch (data.type) {
      case "join":
        await this.handleJoin(ws, game, data);
        break;
      case "reconnect":
        await this.handleReconnect(ws, game, data);
        break;
      case "start":
        await this.handleStart(ws, game);
        break;
      case "bid":
        await this.handleBid(ws, game, data);
        break;
      case "choose_trump":
        await this.handleChooseTrump(ws, game, data);
        break;
      case "play_card":
        await this.handlePlayCard(ws, game, data);
        break;
      case "next_hand":
        await this.handleNextHand(ws, game);
        break;
      default:
        ws.send(JSON.stringify({ type: "error", message: "unknown action" }));
    }
  }

  async webSocketClose(ws) {
    const game = await this.getState();
    if (!game) return;

    // Mark player as disconnected but keep seat
    for (let i = 0; i < game.players.length; i++) {
      if (this.sessions.get(i) === ws) {
        this.sessions.delete(i);
        game.players[i].connected = false;
        break;
      }
    }
    await this.setState(game);
    await this.broadcast(game);
  }

  // --- Action handlers ---
  async handleJoin(ws, game, data) {
    const name = ws.playerName;

    if (!game) {
      // Create new game
      game = {
        phase: "waiting",
        players: [],
        deck: [],
        trumpSuit: null,
        trumpCaller: -1,
        dealer: -1,
        currentTurn: -1,
        currentTrick: [],
        trickLeader: -1,
        teamTricks: [0, 0],
        tricks: [],
        bid: 0,
        highestBidder: -1,
        bidPasses: 0,
        biddersDone: 0,
        handNumber: 0,
        scores: [0, 0],
        lastWinner: -1,
        message: "Waiting for players to join...",
      };
    }

    // Check if reconnecting
    const existingIdx = game.players.findIndex(
      (p) => p.id === ws.playerId
    );
    if (existingIdx >= 0) {
      game.players[existingIdx].connected = true;
      this.sessions.set(existingIdx, ws);
      ws.playerIndex = existingIdx;
      await this.setState(game);
      await this.sendState(ws, game);
      await this.broadcast(game);
      return;
    }

    // New player — find an open seat
    if (game.players.length >= NUM_PLAYERS) {
      ws.send(
        JSON.stringify({ type: "error", message: "Room is full" })
      );
      return;
    }

    const seatIndex = game.players.length;
    const team = seatIndex % 2; // alternating teams: 0,1,0,1,0,1
    game.players.push({
      id: ws.playerId,
      name,
      team,
      seatIndex,
      hand: [],
      tricksWon: 0,
      connected: true,
    });
    this.sessions.set(seatIndex, ws);
    ws.playerIndex = seatIndex;

    if (game.players.length === NUM_PLAYERS) {
      game.message = "All players joined! Ready to start.";
    } else {
      game.message = `Waiting for ${NUM_PLAYERS - game.players.length} more player(s)...`;
    }

    await this.setState(game);
    await this.sendState(ws, game);
    await this.broadcast(game);
  }

  async handleReconnect(ws, game) {
    if (!game) return;
    const idx = game.players.findIndex((p) => p.id === ws.playerId);
    if (idx >= 0) {
      game.players[idx].connected = true;
      this.sessions.set(idx, ws);
      ws.playerIndex = idx;
      await this.setState(game);
      await this.sendState(ws, game);
      await this.broadcast(game);
    }
  }

  async handleStart(ws, game) {
    if (!game || game.players.length < NUM_PLAYERS) {
      ws.send(
        JSON.stringify({ type: "error", message: "Need 6 players to start" })
      );
      return;
    }
    if (game.phase !== "waiting") {
      ws.send(
        JSON.stringify({ type: "error", message: "Game already in progress" })
      );
      return;
    }

    await this.startNewHand(game, true);
  }

  async startNewHand(game, isFirstHand) {
    game.handNumber++;
    game.deck = deal();
    game.trumpSuit = null;
    game.currentTrick = [];
    game.trickLeader = -1;
    game.teamTricks = [0, 0];
    game.tricks = [];
    game.bid = 0;
    game.bidSuit = null;
    game.highestBidder = -1;
    game.bidPasses = 0;
    game.biddersDone = 0;
    game.bids = []; // [{ playerIndex, bid, suit | "pass" }]

    // Deal cards
    for (let i = 0; i < NUM_PLAYERS; i++) {
      game.players[i].hand = game.deck[i];
      game.players[i].tricksWon = 0;
    }
    game.deck = []; // clear after dealing

    // Determine dealer and trump-caller (bidding starts from dealer+1)
    if (isFirstHand) {
      game.dealer = Math.floor(Math.random() * NUM_PLAYERS);
    } else {
      // If trump-caller's team lost, role passes to next player
      if (game.lastWinner >= 0) {
        const losingTeam = game.players[game.trumpCaller].team === 0 ? 1 : 0;
        if (game.scores[losingTeam] > game.scores[1 - losingTeam]) {
          // Trump-caller's team lost, pass to next player
          game.dealer = (game.trumpCaller + 1) % NUM_PLAYERS;
        } else {
          game.dealer = game.trumpCaller;
        }
      }
    }

    // Bidding starts from the player after the dealer
    game.currentTurn = (game.dealer + 1) % NUM_PLAYERS;
    game.phase = "bidding";
    game.message = `Bidding phase — ${game.players[game.currentTurn].name}, place your bid (5–8) with a trump suit, or pass.`;

    await this.setState(game);
    await this.broadcast(game);
  }

  async handleBid(ws, game, data) {
    if (game.phase !== "bidding") {
      ws.send(JSON.stringify({ type: "error", message: "Not in bidding phase" }));
      return;
    }
    if (ws.playerIndex !== game.currentTurn) {
      ws.send(JSON.stringify({ type: "error", message: "Not your turn" }));
      return;
    }

    const bid = data.bid; // number or "pass"
    if (bid === "pass") {
      game.bidPasses++;
      game.biddersDone++;
      game.bids.push({ playerIndex: ws.playerIndex, bid: "pass" });
    } else {
      const n = parseInt(bid, 10);
      if (isNaN(n) || n < 5 || n > TOTAL_TRICKS) {
        ws.send(
          JSON.stringify({
            type: "error",
            message: `Bid must be between 5 and ${TOTAL_TRICKS}`,
          })
        );
        return;
      }
      if (n <= game.bid) {
        ws.send(
          JSON.stringify({
            type: "error",
            message: `Must bid higher than current bid (${game.bid})`,
          })
        );
        return;
      }
      const suit = data.suit;
      if (!SUITS.includes(suit)) {
        ws.send(JSON.stringify({ type: "error", message: "Must choose a trump suit with your bid" }));
        return;
      }
      game.bid = n;
      game.bidSuit = suit;
      game.highestBidder = ws.playerIndex;
      game.biddersDone++;
      game.bids.push({ playerIndex: ws.playerIndex, bid: n, suit });
    }

    // Check if bidding is complete
    // Bidding ends when all players have had a turn, or only one bidder remains
    const activeBidders = NUM_PLAYERS - game.bidPasses;
    if (game.biddersDone >= NUM_PLAYERS || (activeBidders <= 1 && game.bid > 0)) {
      if (game.bid === 0) {
        // Everyone passed — redeal
        game.message = "Everyone passed! Redealing...";
        await this.setState(game);
        await this.broadcast(game);
        await this.startNewHand(game, false);
        return;
      }
      // Bidding complete — trump is the suit chosen by the highest bidder
      game.trumpCaller = game.highestBidder;
      game.trumpSuit = game.bidSuit;
      game.phase = "playing";
      game.trickLeader = game.trumpCaller;
      game.currentTurn = game.trumpCaller;
      game.message = `${game.players[game.highestBidder].name} won the bid with ${game.bid} tricks. Trump is ${game.trumpSuit}! ${game.players[game.trumpCaller].name} leads.`;
      await this.setState(game);
      await this.broadcast(game);
      return;
    }

    // Next bidder
    game.currentTurn = (game.currentTurn + 1) % NUM_PLAYERS;
    game.message = `${game.players[game.currentTurn].name}, your bid (current: ${game.bid} ${game.bidSuit ? "of " + game.bidSuit : ""}, or pass)`;
    await this.setState(game);
    await this.broadcast(game);
  }

  async handlePlayCard(ws, game, data) {
    if (game.phase !== "playing") {
      ws.send(JSON.stringify({ type: "error", message: "Not in playing phase" }));
      return;
    }
    if (ws.playerIndex !== game.currentTurn) {
      ws.send(JSON.stringify({ type: "error", message: "Not your turn" }));
      return;
    }

    const player = game.players[ws.playerIndex];
    const cardId = data.cardId;
    const card = player.hand.find((c) => c.id === cardId);
    if (!card) {
      ws.send(JSON.stringify({ type: "error", message: "Card not in hand" }));
      return;
    }

    // Must follow suit if possible
    if (game.currentTrick.length > 0) {
      const ledSuit = game.currentTrick[0].card.suit;
      const hasLedSuit = player.hand.some((c) => c.suit === ledSuit);
      if (hasLedSuit && card.suit !== ledSuit) {
        ws.send(
          JSON.stringify({ type: "error", message: "Must follow led suit" })
        );
        return;
      }
    }

    // Remove card from hand, add to trick
    player.hand = player.hand.filter((c) => c.id !== cardId);
    game.currentTrick.push({ playerIndex: ws.playerIndex, card });

    if (game.currentTrick.length < NUM_PLAYERS) {
      // Next player
      game.currentTurn = (game.currentTurn + 1) % NUM_PLAYERS;
      game.message = `${game.players[game.currentTurn].name}'s turn`;
      await this.setState(game);
      await this.broadcast(game);
      return;
    }

    // Trick complete — determine winner
    const winnerIdx = trickWinner(game.currentTrick, game.trumpSuit);
    game.players[winnerIdx].tricksWon++;
    const winnerTeam = game.players[winnerIdx].team;
    game.teamTricks[winnerTeam]++;
    game.tricks.push({
      cards: game.currentTrick,
      winner: winnerIdx,
    });

    const trickNum = game.tricks.length;
    game.currentTrick = [];
    game.currentTurn = winnerIdx;
    game.trickLeader = winnerIdx;

    // Check if hand is over (all tricks played)
    if (game.tricks.length >= TOTAL_TRICKS) {
      await this.endHand(game);
      return;
    }

    game.message = `Trick ${trickNum} won by ${game.players[winnerIdx].name}. ${game.players[winnerIdx].name} leads next.`;
    await this.setState(game);
    await this.broadcast(game);
  }

  async endHand(game) {
    const trumpTeam = game.players[game.trumpCaller].team;
    const otherTeam = trumpTeam === 0 ? 1 : 0;
    const trumpTeamTricks = game.teamTricks[trumpTeam];
    const otherTeamTricks = game.teamTricks[otherTeam];

    let result;
    if (trumpTeamTricks >= game.bid) {
      // Trump-caller's team made the bid
      result = "trump_team_wins";
      game.scores[trumpTeam]++;
      game.lastWinner = trumpTeam;
      // Baunie: all tricks
      if (trumpTeamTricks === TOTAL_TRICKS) {
        game.scores[trumpTeam] += 2; // bonus
        result = "baunie";
      }
    } else {
      // Trump-caller's team failed the bid
      result = "trump_team_loses";
      game.scores[otherTeam]++;
      game.lastWinner = otherTeam;
    }

    game.phase = "scoring";
    game.message = `Hand ${game.handNumber} complete! ${
      result === "baunie"
        ? `${game.players[game.trumpCaller].name}'s team won all tricks — BAUNIE!`
        : result === "trump_team_wins"
        ? `${game.players[game.trumpCaller].name}'s team made the bid (${trumpTeamTricks}/${game.bid}).`
        : `${game.players[game.trumpCaller].name}'s team failed the bid (${trumpTeamTricks}/${game.bid}). Opponents win!`
    } Scores: Team A ${game.scores[0]} — Team B ${game.scores[1]}`;

    await this.setState(game);
    await this.broadcast(game);
  }

  async handleNextHand(ws, game) {
    if (game.phase !== "scoring") {
      ws.send(JSON.stringify({ type: "error", message: "Not in scoring phase" }));
      return;
    }
    await this.startNewHand(game, false);
  }

  // --- Broadcast helpers ---
  async sendState(ws, game) {
    const idx = ws.playerIndex;
    if (idx === undefined || idx === null || !game) return;
    ws.send(JSON.stringify({ type: "state", state: this.sanitize(game, idx) }));
  }

  async broadcast(game) {
    if (!game) return;
    const msg = JSON.stringify({ type: "state", state: null });
    for (const [idx, ws] of this.sessions) {
      if (ws.readyState === 1) {
        ws.send(JSON.stringify({ type: "state", state: this.sanitize(game, idx) }));
      }
    }
  }

  // Hide other players' hands
  sanitize(game, playerIndex) {
    const g = JSON.parse(JSON.stringify(game));
    if (g.players) {
      for (let i = 0; i < g.players.length; i++) {
        if (i !== playerIndex) {
          g.players[i].hand = g.players[i].hand.map(() => null); // hidden
        }
        g.players[i].handCount = g.players[i].hand.length;
      }
    }
    g.yourIndex = playerIndex;
    return g;
  }
}

// ---------------------------------------------------------------------------
// Worker entry — routes to GameRoom DOs
// ---------------------------------------------------------------------------
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Route /api/room/:id → GameRoom DO
    const match = url.pathname.match(/^\/api\/room\/([\w-]+)/);
    if (match) {
      const roomId = match[1];
      const id = env.GAME_ROOM.idFromName(roomId);
      // Register in RoomRegistry for admin listing
      const regId = env.ROOM_REGISTRY.idFromName("global");
      env.ROOM_REGISTRY.get(regId).fetch(new Request("https://celld/register", {
        method: "POST",
        body: JSON.stringify({ roomId }),
        headers: { "Content-Type": "application/json" },
      }));
      return env.GAME_ROOM.get(id).fetch(request);
    }

    // Create a new room
    if (url.pathname === "/api/create-room") {
      const roomId = crypto.randomUUID().slice(0, 8);
      // Register in the RoomRegistry
      const regId = env.ROOM_REGISTRY.idFromName("global");
      await env.ROOM_REGISTRY.get(regId).fetch(new Request("https://celld/register", {
        method: "POST",
        body: JSON.stringify({ roomId }),
        headers: { "Content-Type": "application/json" },
      }));
      return new Response(JSON.stringify({ roomId }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Admin: list rooms — queries the RoomRegistry DO
    if (url.pathname === "/api/admin/rooms") {
      const regId = env.ROOM_REGISTRY.idFromName("global");
      const regResp = await env.ROOM_REGISTRY.get(regId).fetch(new Request("https://celld/list"));
      const regData = await regResp.json();
      const rooms = [];
      for (const roomId of (regData.rooms || [])) {
        try {
          const id = env.GAME_ROOM.idFromName(roomId);
          const infoResp = await env.GAME_ROOM.get(id).fetch(new Request("https://celld/info"));
          const info = await infoResp.json();
          if (info.exists) {
            rooms.push({ id: roomId, ...info });
          }
        } catch {}
      }
      return new Response(JSON.stringify({ rooms }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Admin: kill a room
    const killMatch = url.pathname.match(/^\/api\/admin\/kill\/([\w-]+)$/);
    if (killMatch) {
      const roomId = killMatch[1];
      const id = env.GAME_ROOM.idFromName(roomId);
      const resp = await env.GAME_ROOM.get(id).fetch(new Request("https://celld/kill", { method: "DELETE" }));
      // Also unregister from registry
      const regId = env.ROOM_REGISTRY.idFromName("global");
      await env.ROOM_REGISTRY.get(regId).fetch(new Request("https://celld/unregister", {
        method: "POST", body: JSON.stringify({ roomId }),
        headers: { "Content-Type": "application/json" },
      }));
      return new Response(resp.body, {
        status: resp.status,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Everything else falls through to static assets (the Vite frontend)
    return new Response("Not found", { status: 404 });
  },
};
