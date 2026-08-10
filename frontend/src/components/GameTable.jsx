import React from "react";
import Card from "./Card.jsx";
import BiddingPanel from "./BiddingPanel.jsx";

const SUIT_SYMBOLS = { hearts: "♥", diamonds: "♦", clubs: "♣", spades: "♠" };
const SUIT_COLORS = { hearts: "#ef6b7b", diamonds: "#ef6b7b", clubs: "#172033", spades: "#172033" };

export default function GameTable({ state, send }) {
  const { phase, players, currentTurn, yourIndex, trumpSuit, trumpCaller, bid, message } = state;
  const me = players[yourIndex];
  const isMyTurn = currentTurn === yourIndex;

  return (
    <div className="game-shell">
      <aside className="players-panel">
        <div className="panel-heading">
          <div>
            <div className="eyebrow">TABLE</div>
            <h2>Players</h2>
          </div>
          <span className="player-count">{players.length}/6</span>
        </div>
        <div className="player-list">
          {players.map((p, i) => {
            const isCurrent = currentTurn === i;
            const isMe = i === yourIndex;
            return (
              <div className={`player-row ${isCurrent ? "is-current" : ""} ${isMe ? "is-me" : ""}`} key={p.id || i}>
                <div className="player-avatar" style={{ background: p.team === 0 ? "var(--team-a)" : "var(--team-b)" }}>
                  {p.name[0]?.toUpperCase()}
                </div>
                <div className="player-details">
                  <div className="player-name">{p.name} {isMe && <span className="you-tag">YOU</span>}</div>
                  <div className="player-meta">
                    <span className={`team-dot team-${p.team}`} /> Team {p.team === 0 ? "A" : "B"}
                    <span>•</span> {p.tricksWon || 0} tricks
                  </div>
                </div>
                <div className="player-status">
                  {trumpCaller === i && <span className="dealer-tag" title="Trump caller">♛</span>}
                  <span className={`connection-dot ${p.connected ? "online" : "offline"}`} />
                </div>
              </div>
            );
          })}
        </div>
        <div className="score-panel">
          <div className="eyebrow">SCORE</div>
          <div className="score-line"><span><i className="team-dot team-0" /> Team A</span><strong>{state.scores?.[0] ?? 0}</strong></div>
          <div className="score-line"><span><i className="team-dot team-1" /> Team B</span><strong>{state.scores?.[1] ?? 0}</strong></div>
        </div>
      </aside>

      <main className="table-panel">
        <div className="table-header">
          <div>
            <div className="eyebrow">HAND {state.handNumber || "—"} · {phase?.toUpperCase()}</div>
            <h1>{phase === "playing" ? "Current trick" : phase === "bidding" ? "Make your bid" : "Hand complete"}</h1>
          </div>
          <div className="table-badges">
            {bid > 0 && <span className="info-badge">Bid <b>{bid}</b> · {players[trumpCaller]?.name}</span>}
            {trumpSuit && <span className="info-badge trump-badge">Trump <b style={{ color: SUIT_COLORS[trumpSuit] }}>{SUIT_SYMBOLS[trumpSuit]}</b></span>}
          </div>
        </div>
        <div className="message-banner">{message}</div>
        <div className="trick-area">
          {state.currentTrick?.length ? state.currentTrick.map((play, j) => (
            <div className="played-card" key={j}>
              <span>{players[play.playerIndex]?.name}</span>
              <Card card={play.card} small />
            </div>
          )) : <div className="empty-trick"><span>♠</span><p>{phase === "playing" ? "Cards played this trick will appear here" : "Waiting for the hand to begin"}</p></div>}
        </div>
        {phase === "bidding" && <BiddingPanel state={state} send={send} isMyTurn={isMyTurn} />}
        {phase === "scoring" && (
          <div className="scoring-card">
            <div className="eyebrow">ROUND COMPLETE</div>
            <h2>Hand complete</h2>
            <p>Team A {state.scores[0]} <span>·</span> Team B {state.scores[1]}</p>
            <button className="primary-button" onClick={() => send({ type: "next_hand" })}>Next hand</button>
          </div>
        )}
      </main>

      <aside className="hand-panel">
        <div className="panel-heading">
          <div><div className="eyebrow">YOUR CARDS</div><h2>{me?.hand?.length || 0} cards</h2></div>
          {isMyTurn && phase === "playing" && <span className="turn-pill">YOUR TURN</span>}
        </div>
        <div className="hand-grid">
          {me?.hand?.map((card) => {
            const canPlay = phase === "playing" && isMyTurn && canPlayCard(card, state);
            return <Card key={card.id} card={card} disabled={phase !== "playing" || !canPlay} onClick={() => send({ type: "play_card", cardId: card.id })} />;
          })}
        </div>
        {phase === "playing" && <p className="hint">{isMyTurn ? "Choose a card to play" : `Waiting for ${players[currentTurn]?.name || "the next player"}`}</p>}
      </aside>
    </div>
  );
}

function canPlayCard(card, state) {
  if (!state.currentTrick?.length) return true;
  const ledSuit = state.currentTrick[0].card.suit;
  const myHand = state.players[state.yourIndex].hand;
  return !myHand.some((c) => c.suit === ledSuit) || card.suit === ledSuit;
}
