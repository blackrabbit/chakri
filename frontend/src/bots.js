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
    const ws = new WebSocket(`${base}?name=${encodeURIComponent(name)}&pid=${pid}`);
    const bot = { ws, name, pid, index: null };
    bots.push(bot);

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type !== "state") return;
      const state = msg.state;
      if (!state) return;

      bot.index = state.yourIndex;

      // Track joins
      if (state.phase === "waiting" && bot.index !== null && !bot._counted) {
        bot._counted = true;
        joinedCount++;
        if (joinedCount >= count && onAllJoined) onAllJoined();
      }

      // Auto-play logic
      handleBotAction(bot, state, ws);
    };

    ws.onerror = () => {};
  }

  return bots;
}

function handleBotAction(bot, state, ws) {
  if (ws.readyState !== 1) return;
  const myIndex = state.yourIndex;
  if (myIndex === null || myIndex === undefined) return;

  // Bidding phase: pass
  if (state.phase === "bidding" && state.currentTurn === myIndex) {
    if (bot._bid) return;
    bot._bid = true;
    setTimeout(() => {
      if (ws.readyState === 1) {
        ws.send(JSON.stringify({ type: "bid", bid: "pass" }));
      }
    }, 500 + Math.random() * 1000);
    return;
  }

  // Reset bid flag when out of bidding
  if (state.phase !== "bidding") {
    bot._bid = false;
  }

  // Trump selection: pick random suit
  if (state.phase === "trump_selection" && state.trumpCaller === myIndex) {
    if (bot._trump) return;
    bot._trump = true;
    const suit = SUITS[Math.floor(Math.random() * SUITS.length)];
    setTimeout(() => {
      if (ws.readyState === 1) {
        ws.send(JSON.stringify({ type: "choose_trump", suit }));
      }
    }, 800 + Math.random() * 1200);
    return;
  }

  if (state.phase !== "trump_selection") {
    bot._trump = false;
  }

  // Playing phase: play a random valid card
  if (state.phase === "playing" && state.currentTurn === myIndex) {
    if (bot._played) return;
    bot._played = true;

    const me = state.players[myIndex];
    if (!me || !me.hand || me.hand.length === 0) return;

    // Determine valid cards (must follow suit if possible)
    let validCards = me.hand;
    if (state.currentTrick && state.currentTrick.length > 0) {
      const ledSuit = state.currentTrick[0].card.suit;
      const hasLedSuit = me.hand.some((c) => c.suit === ledSuit);
      if (hasLedSuit) {
        validCards = me.hand.filter((c) => c.suit === ledSuit);
      }
    }

    const card = validCards[Math.floor(Math.random() * validCards.length)];
    setTimeout(() => {
      if (ws.readyState === 1) {
        ws.send(JSON.stringify({ type: "play_card", cardId: card.id }));
      }
    }, 600 + Math.random() * 1400);
    return;
  }

  // Reset played flag when it's no longer our turn
  if (state.phase === "playing" && state.currentTurn !== myIndex) {
    bot._played = false;
  }

  // Scoring phase: auto-advance after a delay
  if (state.phase === "scoring") {
    if (bot._nextHand) return;
    bot._nextHand = true;
    setTimeout(() => {
      if (ws.readyState === 1) {
        ws.send(JSON.stringify({ type: "next_hand" }));
      }
      bot._nextHand = false;
    }, 2000 + Math.random() * 2000);
    return;
  }

  if (state.phase !== "scoring") {
    bot._nextHand = false;
  }
}

export function closeBots(bots) {
  for (const bot of bots) {
    try {
      bot.ws.close();
    } catch {}
  }
}
