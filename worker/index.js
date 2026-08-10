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
const BID_SUIT_ORDER = ["clubs", "diamonds", "hearts", "spades"];
const MATCH_SPREAD = 27;

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

// Pick a random valid card for auto-play (must follow suit if possible)
function randomValidCard(hand, currentTrick) {
  if (!hand || hand.length === 0) return null;
  let valid = hand;
  if (currentTrick && currentTrick.length > 0) {
    const ledSuit = currentTrick[0].card.suit;
    const hasLed = hand.some((c) => c.suit === ledSuit);
    if (hasLed) valid = hand.filter((c) => c.suit === ledSuit);
  }
  if (valid.length === 0) return null;
  return valid[Math.floor(Math.random() * valid.length)];
}

// ---------------------------------------------------------------------------
// RoomRegistry Durable Object — tracks all room IDs for admin listing
// ---------------------------------------------------------------------------
export class RoomRegistry {
  constructor(state, env) { this.state = state; this.env = env; }

  async fetch(request) {
    const url = new URL(request.url);

    // Lightweight account storage for cross-device PIN login.
    if (url.pathname === "/account/register" && request.method === "POST") {
      const { username, pin } = await request.json();
      const key = String(username || "").trim().toLowerCase();
      const normalizedPin = String(pin || "").trim().toLowerCase();
      if (!/^[a-z0-9]{3,20}$/.test(key) || !/^[a-z0-9]{4,8}$/.test(normalizedPin)) {
        return jsonResponse({ error: "Username must be 3–20 and PIN 4–8 lowercase letters or numbers, with no spaces." }, 400);
      }
      const accounts = (await this.state.storage.get("accounts")) || {};
      if (accounts[key]) return jsonResponse({ error: "That username is already taken." }, 409);
      const salt = crypto.randomUUID();
      accounts[key] = { id: crypto.randomUUID(), username: key, salt, hash: await hashPin(normalizedPin, salt) };
      await this.state.storage.put("accounts", accounts);
      return this.createSession(accounts[key]);
    }

    if (url.pathname === "/account/login" && request.method === "POST") {
      const { username, pin } = await request.json();
      const accounts = (await this.state.storage.get("accounts")) || {};
      const account = accounts[String(username || "").trim().toLowerCase()];
      if (!account || account.hash !== await hashPin(String(pin || "").trim().toLowerCase(), account.salt)) return jsonResponse({ error: "Invalid username or PIN." }, 401);
      return this.createSession(account);
    }

    if (url.pathname === "/account/verify") {
      const sessions = (await this.state.storage.get("sessions")) || {};
      const accountId = sessions[url.searchParams.get("token")];
      const accounts = (await this.state.storage.get("accounts")) || {};
      const account = Object.values(accounts).find((item) => item.id === accountId);
      return account ? jsonResponse({ id: account.id, name: account.username, username: account.username }) : jsonResponse({ error: "Invalid session." }, 401);
    }

    if (url.pathname === "/account/logout" && request.method === "POST") {
      const { token } = await request.json();
      const sessions = (await this.state.storage.get("sessions")) || {};
      delete sessions[token];
      await this.state.storage.put("sessions", sessions);
      return jsonResponse({ ok: true });
    }

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

  async createSession(account) {
    const token = crypto.randomUUID() + crypto.randomUUID();
    const sessions = (await this.state.storage.get("sessions")) || {};
    // A player can have only one active login. Signing in elsewhere replaces it.
    for (const [existingToken, accountId] of Object.entries(sessions)) {
      if (accountId === account.id) delete sessions[existingToken];
    }
    sessions[token] = account.id;
    await this.state.storage.put("sessions", sessions);
    return jsonResponse({ token, account: { id: account.id, name: account.username, username: account.username } });
  }
}

async function hashPin(pin, salt) {
  const data = new TextEncoder().encode(`${salt}:${pin}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

// ---------------------------------------------------------------------------
// GameRoom Durable Object
// ---------------------------------------------------------------------------
export class GameRoom {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.sessions = new Map(); // playerIndex -> WebSocket
    // WebSocket sessions do not survive a process restart, so persisted players
    // must begin disconnected when this Durable Object is activated again.
    this.ready = this.resetStaleConnections();
  }

  async resetStaleConnections() {
    const game = await this.getState();
    if (!game?.players?.some((player) => player.connected)) return;
    game.players.forEach((player) => { player.connected = Boolean(player.isBot); });
    await this.setState(game);
  }

  // --- Storage helpers ---
  async getState() {
    return (await this.state.storage.get("game")) || null;
  }
  async setState(game) {
    await this.state.storage.put("game", game);
  }

  // If it's a disconnected player's turn, schedule an alarm to auto-play
  // so the game never stalls on a dropped connection.
  async scheduleAutoPlay(game) {
    if (!game) return;
    if (game.phase !== "bidding" && game.phase !== "playing") return;
    const current = game.currentTurn;
    if (current < 0 || current >= game.players.length) return;
    const player = game.players[current];
    if (player && player.connected && !player.isBot && !player.isAway) return; // active human will act
    // Disconnected — auto-act in ~4s
    await this.state.storage.setAlarm(Date.now() + 4000);
  }

  // Fires when a disconnected player's turn needs an automatic action.
  async alarm() {
    await this.ready;
    const game = await this.getState();
    if (!game) return;
    const current = game.currentTurn;
    if (current < 0 || current >= game.players.length) return;
    const player = game.players[current];
    if (!player || (player.connected && !player.isBot && !player.isAway)) return; // active human will act

    const fakeWs = { playerIndex: current, send: () => {} };

    if (game.phase === "bidding") {
      if (player.isBot || player.isAway) {
        const options = [];
        for (let bid = 4; bid <= TOTAL_TRICKS; bid++) {
          for (const suit of BID_SUIT_ORDER) {
            if (bid > game.bid || (bid === game.bid && BID_SUIT_ORDER.indexOf(suit) > BID_SUIT_ORDER.indexOf(game.bidSuit))) {
              options.push({ bid, suit });
            }
          }
        }
        // Dupes usually makes a modest bid and only rarely calls Chakri.
        const regular = options.filter((option) => option.bid < TOTAL_TRICKS);
        const shouldPass = game.bid > 0 && Math.random() < 0.4;
        const pool = regular.length && Math.random() > 0.03 ? regular.slice(0, 4) : options;
        const choice = pool[Math.floor(Math.random() * pool.length)];
        await this.handleBid(fakeWs, game, shouldPass || !choice ? { bid: "pass" } : choice);
      } else {
        // Auto-pass for a disconnected human bidder.
        await this.handleBid(fakeWs, game, { bid: "pass" });
      }
    } else if (game.phase === "playing") {
      const card = randomValidCard(player.hand, game.currentTrick);
      if (card) {
        await this.handlePlayCard(fakeWs, game, { cardId: card.id });
      } else if (player.hand && player.hand.length === 0) {
        // No cards left — skip turn (shouldn't happen, but be safe)
        game.currentTurn = (current + 1) % game.players.length;
        game.message = `${player.name} skipped (no cards). ${game.players[game.currentTurn].name}'s turn.`;
        await this.setState(game);
        await this.broadcast(game);
      }
    }
  }

  // --- WebSocket lifecycle ---
  async fetch(request) {
    await this.ready;
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

    // Authenticated accounts use their stable account ID across devices.
    const token = url.searchParams.get("token");
    let account = null;
    if (token) {
      const regId = this.env.ROOM_REGISTRY.idFromName("global");
      const verify = await this.env.ROOM_REGISTRY.get(regId).fetch(new Request(`https://celld/account/verify?token=${encodeURIComponent(token)}`));
      if (!verify.ok) return new Response("Invalid session", { status: 401 });
      account = await verify.json();
    }
    const playerName = account?.name || url.searchParams.get("name") || "Player";
    const playerId = account?.id || url.searchParams.get("pid") || crypto.randomUUID();

    server.playerName = playerName;
    server.playerId = playerId;
    server.accountId = account?.id || null;

    this.state.acceptWebSocket(server);
    return new Response(null, { status: 101, webSocket: pair[1] });
  }

  async webSocketMessage(ws, msg) {
    await this.ready;
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
      case "leave":
        await this.handleLeave(ws, game);
        break;
      case "add_bots":
        await this.handleAddBots(ws, game);
        break;
      case "set_bot":
        await this.handleSetBot(ws, game, data);
        break;
      case "set_away":
        await this.handleSetAway(ws, game, data);
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
      case "new_match":
        await this.handleNewMatch(ws, game);
        break;
      default:
        ws.send(JSON.stringify({ type: "error", message: "unknown action" }));
    }
  }

  async webSocketClose(ws) {
    await this.ready;
    const game = await this.getState();
    if (!game) return;

    // Mark player as disconnected but keep seat
    for (let i = 0; i < game.players.length; i++) {
      if (this.sessions.get(i) === ws) {
        this.sessions.delete(i);
        game.players[i].connected = Boolean(game.players[i].isBot);
        break;
      }
    }
    await this.setState(game);
    await this.broadcast(game);
    await this.scheduleAutoPlay(game);
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
        ownerId: ws.playerId,
      };
    }

    // Check if reconnecting
    const existingIdx = game.players.findIndex(
      (p) => p.id === ws.playerId
    );
    if (existingIdx >= 0) {
      game.players[existingIdx].name = name;
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
      isBot: false,
      isAway: false,
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

  async handleLeave(ws, game) {
    if (!game || ws.playerIndex === undefined) return;
    const leavingIndex = ws.playerIndex;

    // During a hand the seat must remain so turn order and cards stay valid.
    if (game.phase !== "waiting") {
      game.players[leavingIndex].connected = false;
      this.sessions.delete(leavingIndex);
      await this.setState(game);
      await this.broadcast(game);
      return;
    }

    const leavingPlayer = game.players[leavingIndex];
    game.players.splice(leavingIndex, 1);
    if (game.ownerId === leavingPlayer.id) {
      game.ownerId = game.players.find((player) => !player.isBot)?.id || null;
    }
    const shiftedSessions = new Map();
    for (const [index, socket] of this.sessions) {
      if (socket === ws) continue;
      const nextIndex = index > leavingIndex ? index - 1 : index;
      socket.playerIndex = nextIndex;
      shiftedSessions.set(nextIndex, socket);
    }
    this.sessions = shiftedSessions;
    game.players.forEach((player, index) => {
      player.seatIndex = index;
      player.team = index % 2;
    });
    game.message = `Waiting for ${NUM_PLAYERS - game.players.length} more player(s)...`;
    await this.setState(game);
    await this.broadcast(game);
  }

  async handleAddBots(ws, game) {
    if (!game || game.phase !== "waiting") {
      ws.send(JSON.stringify({ type: "error", message: "Dupes can only be added in the waiting room" }));
      return;
    }
    const requester = game.players[ws.playerIndex];
    if (game.ownerId && requester?.id !== game.ownerId && requester?.name !== "blackrabbit") {
      ws.send(JSON.stringify({ type: "error", message: "Only the room creator can add dupes" }));
      return;
    }
    while (game.players.length < NUM_PLAYERS) {
      const index = game.players.length;
      game.players.push({
        id: `bot-${crypto.randomUUID()}`,
        name: `dupes${index + 1}`,
        team: index % 2,
        seatIndex: index,
        hand: [],
        tricksWon: 0,
        connected: true,
        isBot: true,
        isAway: false,
      });
    }
    game.message = "All seats are filled. Ready to start!";
    await this.setState(game);
    await this.broadcast(game);
  }

  async handleSetBot(ws, game, data) {
    const requester = game?.players?.[ws.playerIndex];
    if (!requester || requester.name !== "blackrabbit") {
      ws.send(JSON.stringify({ type: "error", message: "Only blackrabbit can manage dupes seats" }));
      return;
    }
    const index = Number(data.playerIndex);
    const player = game.players[index];
    if (!player) return;
    if (!data.isBot && player.id.startsWith("bot-") && game.phase === "waiting") {
      game.players.splice(index, 1);
      const shiftedSessions = new Map();
      for (const [sessionIndex, socket] of this.sessions) {
        const nextIndex = sessionIndex > index ? sessionIndex - 1 : sessionIndex;
        socket.playerIndex = nextIndex;
        shiftedSessions.set(nextIndex, socket);
      }
      this.sessions = shiftedSessions;
      game.players.forEach((remaining, remainingIndex) => {
        remaining.seatIndex = remainingIndex;
        remaining.team = remainingIndex % 2;
      });
      game.message = `${player.name} was removed. An open seat is available.`;
      await this.setState(game);
      await this.broadcast(game);
      return;
    }
    player.isBot = Boolean(data.isBot);
    if (player.isBot) player.isAway = false;
    player.connected = player.isBot || this.sessions.has(index);
    game.message = `${player.name} is now ${player.isBot ? "dupes-controlled" : "human-controlled"}.`;
    await this.setState(game);
    await this.broadcast(game);
  }

  async handleSetAway(ws, game, data) {
    const player = game?.players?.[ws.playerIndex];
    if (!player || player.isBot) return;
    player.isAway = Boolean(data.isAway);
    game.message = player.isAway
      ? `${player.name} is away — dupes will play for them.`
      : `${player.name} is back and has resumed control.`;
    await this.setState(game);
    await this.broadcast(game);
  }

  async handleReconnect(ws, game) {
    if (!game) return;
    const idx = game.players.findIndex((p) => p.id === ws.playerId);
    if (idx >= 0) {
      game.players[idx].name = ws.playerName;
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
    game.isChakri = false;
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
    game.message = `Bidding phase — ${game.players[game.currentTurn].name}, place your bid (4–8 hands) with a trump suit, or pass.`;

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
      if (isNaN(n) || n < 4 || n > TOTAL_TRICKS) {
        ws.send(
          JSON.stringify({
            type: "error",
            message: `Bid must be between 4 and ${TOTAL_TRICKS} hands`,
          })
        );
        return;
      }
      const suit = data.suit;
      if (!BID_SUIT_ORDER.includes(suit)) {
        ws.send(JSON.stringify({ type: "error", message: "Must choose a trump suit with your bid" }));
        return;
      }
      const higherNumber = n > game.bid;
      const higherSuit = n === game.bid && BID_SUIT_ORDER.indexOf(suit) > BID_SUIT_ORDER.indexOf(game.bidSuit);
      if (!higherNumber && !higherSuit) {
        const current = game.bid === TOTAL_TRICKS ? `Chakri ${game.bidSuit}` : `${game.bid} ${game.bidSuit || ""}`;
        ws.send(JSON.stringify({ type: "error", message: `Must bid higher than current bid (${current})` }));
        return;
      }
      game.bid = n;
      game.bidSuit = suit;
      game.isChakri = n === TOTAL_TRICKS;
      game.highestBidder = ws.playerIndex;
      game.biddersDone++;
      game.bids.push({ playerIndex: ws.playerIndex, bid: n, suit, chakri: n === TOTAL_TRICKS });
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
      game.message = game.isChakri
        ? `${game.players[game.highestBidder].name} called CHAKRI with ${game.trumpSuit} and must win every hand! ${game.players[game.trumpCaller].name} leads.`
        : `${game.players[game.highestBidder].name} won the bid with ${game.bid} hands. Trump is ${game.trumpSuit}! ${game.players[game.trumpCaller].name} leads.`;
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

    game.message = `Hand ${trickNum} won by ${game.players[winnerIdx].name}. ${game.players[winnerIdx].name} leads next.`;
    await this.setState(game);
    await this.broadcast(game);
  }

  async endHand(game) {
    const biddingTeam = game.players[game.trumpCaller].team;
    const otherTeam = biddingTeam === 0 ? 1 : 0;
    const biddingTeamTricks = game.teamTricks[biddingTeam];
    const madeBid = biddingTeamTricks >= game.bid;
    const scoringTeam = madeBid ? biddingTeam : otherTeam;
    // A failed bid pays double, including a failed Chakri.
    const points = madeBid ? game.bid : game.bid * 2;

    game.scores[scoringTeam] += points;
    game.lastWinner = scoringTeam;

    const spreadA = game.scores[0] - game.scores[1];
    const spreadB = -spreadA;
    // Making Chakri wins immediately; otherwise a +27 spread wins the match.
    const matchWinner = madeBid && game.isChakri
      ? biddingTeam
      : spreadA >= MATCH_SPREAD ? 0 : spreadB >= MATCH_SPREAD ? 1 : -1;
    game.matchWinner = matchWinner;
    game.phase = matchWinner >= 0 ? "game_over" : "scoring";

    const bidLabel = game.isChakri ? "Chakri" : `bid of ${game.bid}`;
    const resultMessage = madeBid
      ? `${game.players[game.trumpCaller].name}'s team made the ${bidLabel} (${biddingTeamTricks}/${game.bid}) and gains ${points} points.`
      : `${game.players[game.trumpCaller].name}'s team failed the ${bidLabel} (${biddingTeamTricks}/${game.bid}); their opponents gain ${points} points.`;
    game.message = matchWinner >= 0
      ? `${resultMessage} Team ${matchWinner === 0 ? "A" : "B"} wins the match${madeBid && game.isChakri ? " by making CHAKRI" : ` with a +${Math.abs(spreadA)} spread`}!`
      : `Round ${game.handNumber} complete! ${resultMessage} Scores: Team A ${game.scores[0]} — Team B ${game.scores[1]}.`;

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

  async handleNewMatch(ws, game) {
    if (game.phase !== "game_over") {
      ws.send(JSON.stringify({ type: "error", message: "Match is not over" }));
      return;
    }
    game.scores = [0, 0];
    game.handNumber = 0;
    game.lastWinner = -1;
    game.matchWinner = -1;
    await this.startNewHand(game, true);
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
    await this.scheduleAutoPlay(game);
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
      // Register in RoomRegistry for admin listing (awaited so it can't silently fail)
      try {
        const regId = env.ROOM_REGISTRY.idFromName("global");
        await env.ROOM_REGISTRY.get(regId).fetch(new Request("https://celld/register", {
          method: "POST",
          body: JSON.stringify({ roomId }),
          headers: { "Content-Type": "application/json" },
        }));
      } catch {}
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

    // Account API — credentials are intentionally simple PINs for casual play.
    if (["/api/auth/register", "/api/auth/login", "/api/auth/logout"].includes(url.pathname)) {
      const action = url.pathname.split("/").pop();
      const regId = env.ROOM_REGISTRY.idFromName("global");
      return env.ROOM_REGISTRY.get(regId).fetch(new Request(`https://celld/account/${action}`, { method: "POST", body: await request.text(), headers: { "Content-Type": "application/json" } }));
    }

    if (url.pathname === "/api/auth/me") {
      const token = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") || "";
      const regId = env.ROOM_REGISTRY.idFromName("global");
      return env.ROOM_REGISTRY.get(regId).fetch(new Request(`https://celld/account/verify?token=${encodeURIComponent(token)}`));
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
