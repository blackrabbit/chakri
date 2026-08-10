// Bot client — opens WebSocket connections that auto-join and auto-play.
// Used for testing with room name "test".

const SUITS = ["hearts", "diamonds", "clubs", "spades"];

function uuid() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (crypto.getRandomValues(new Uint8Array(1))[0] ?? Math.random() * 256) & 0xf;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function createBots(roomId, count, onAllJoined) {
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  const base = `${proto}//${window.location.host}/api/room/${roomId}`;
  const bots = [];
  let joinedCount = 0;

  for (let i = 0; i < count; i++) {
    const name = `Bot ${i + 1}`;
    const pid = `bot-${uuid()}`;
    const bot = {
      ws: null,
      name,
      pid,
      index: null,
      // Track the last action we took so we don't duplicate it
      lastBidKey: null,
      lastPlayKey: null,
      nextHandSent: false,
      counted: false,
      url: `${base}?name=${encodeURIComponent(name)}&pid=${pid}`,
    };
    bots.push(bot);
    connectBot(bot);
  }

  return bots;

  function connectBot(bot) {
    const ws = new WebSocket(bot.url);
    bot.ws = ws;
    let reconnectTimer;

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type !== "state") return;
      const state = msg.state;
      if (!state) return;

      bot.index = state.yourIndex;

      // Track joins
      if (state.phase === "waiting" && bot.index !== null && !bot.counted) {
        bot.counted = true;
        joinedCount++;
        if (joinedCount >= count && onAllJoined) onAllJoined();
      }

      // Auto-play logic
      handleBotAction(bot, state, ws);
    };

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "join" }));
    };
    ws.onerror = () => {};
    ws.onclose = () => {
      // Reconnect so bots survive node restarts / network blips
      clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(() => connectBot(bot), 2000);
    };
  }
}

function handleBotAction(bot, state, ws) {
  if (ws.readyState !== 1) return;
  const myIndex = state.yourIndex;
  if (myIndex === null || myIndex === undefined) return;

  // --- Bidding phase ---
  if (state.phase === "bidding" && state.currentTurn === myIndex) {
    // Use a key that includes hand number + turn so we only act once per turn
    const bidKey = `${state.handNumber}-${state.biddersDone}`;
    if (bot.lastBidKey === bidKey) return; // already acted this turn
    bot.lastBidKey = bidKey;

    setTimeout(() => {
      if (ws.readyState !== 1) return;
      // 70% chance to pass, 30% chance to bid (so a human usually wins)
      if (Math.random() < 0.7) {
        ws.send(JSON.stringify({ type: "bid", bid: "pass" }));
      } else {
        const minBid = Math.max(5, (state.bid || 0) + 1);
        const maxBid = 8;
        if (minBid > maxBid) {
          ws.send(JSON.stringify({ type: "bid", bid: "pass" }));
        } else {
          const bidNum = Math.floor(Math.random() * (maxBid - minBid + 1)) + minBid;
          const suit = SUITS[Math.floor(Math.random() * SUITS.length)];
          ws.send(JSON.stringify({ type: "bid", bid: bidNum, suit }));
        }
      }
    }, 500 + Math.random() * 1000);
    return;
  }

  // --- Playing phase ---
  if (state.phase === "playing" && state.currentTurn === myIndex) {
    const me = state.players[myIndex];
    if (!me || !me.hand || me.hand.length === 0) return;

    // Use a key that includes hand number + trick number + cards in trick
    // so we act once per trick-turn, and reset when a new trick starts
    const playKey = `${state.handNumber}-${state.tricks.length}-${state.currentTrick.length}`;
    if (bot.lastPlayKey === playKey) return; // already acted for this trick slot
    bot.lastPlayKey = playKey;

    // Determine valid cards (must follow suit if possible)
    let validCards = me.hand;
    if (state.currentTrick && state.currentTrick.length > 0) {
      const ledSuit = state.currentTrick[0].card.suit;
      const hasLedSuit = me.hand.some((c) => c.suit === ledSuit);
      if (hasLedSuit) {
        validCards = me.hand.filter((c) => c.suit === ledSuit);
      }
    }

    if (validCards.length === 0) return;

    const card = validCards[Math.floor(Math.random() * validCards.length)];
    setTimeout(() => {
      if (ws.readyState === 1) {
        ws.send(JSON.stringify({ type: "play_card", cardId: card.id }));
      }
    }, 600 + Math.random() * 1400);
    return;
  }

  // --- Scoring phase: auto-advance ---
  if (state.phase === "scoring") {
    // Only one bot needs to send next_hand, but all can try —
    // the server only accepts it in scoring phase.
    // Use hand number to ensure we only send once per scoring round.
    const scoreKey = `${state.handNumber}`;
    if (bot.nextHandSent === scoreKey) return;
    bot.nextHandSent = scoreKey;

    setTimeout(() => {
      if (ws.readyState === 1) {
        ws.send(JSON.stringify({ type: "next_hand" }));
      }
    }, 2000 + Math.random() * 2000);
    return;
  }

  // Reset scoring tracker when not in scoring phase
  if (state.phase !== "scoring") {
    bot.nextHandSent = false;
  }
}

export function closeBots(bots) {
  for (const bot of bots) {
    try {
      bot.ws.close();
    } catch {}
  }
}
