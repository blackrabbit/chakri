import React from "react";

export default function Lobby({ state, send, yourName, roomId }) {
  const players = state?.players || [];
  const seats = Array.from({ length: 6 }, (_, i) => players[i] || null);
  const me = players[state?.yourIndex];
  const canAddBots = players.length > 0 && players.length < 6 && (me?.id === state?.ownerId || yourName === "blackrabbit");
  const canManageBots = yourName === "blackrabbit";

  return <div className="lobby-page">
    <div className="lobby-card">
      <div className="lobby-header"><div><div className="eyebrow">ROOM {roomId}</div><h1>Waiting room</h1></div><span className="player-count">{players.length} / 6 joined</span></div>
      <p className="lobby-message">{state?.message || "Connecting to the table…"}</p>
      <div className="lobby-seats">{seats.map((p, i) => <div className={`lobby-seat ${p ? "filled" : ""}`} key={p?.id || i}>
        {p ? <>
          <div className="lobby-avatar" style={{ background: p.team === 0 ? "var(--team-a)" : "var(--team-b)" }}>{p.isBot ? "◆" : p.name[0]?.toUpperCase()}</div>
          <strong>{p.name}</strong>
          <small><span className={`team-dot team-${p.team}`} /> Team {p.team === 0 ? "A" : "B"} {p.isBot && <b className="bot-label">· DUPES</b>} {p.isAway && <b className="away-tag">· AWAY</b>}</small>
          {!p.connected && !p.isBot && <small className="offline-label">Disconnected</small>}
          {i === state?.yourIndex && !p.isBot && <button className={`seat-bot-button ${p.isAway ? "is-away" : ""}`} onClick={() => send({ type: "set_away", isAway: !p.isAway })}>{p.isAway ? "I'm back" : "Mark away"}</button>}
          {canManageBots && <button className="seat-bot-button" onClick={() => send({ type: "set_bot", playerIndex: i, isBot: !p.isBot })}>{p.isBot && p.id?.startsWith("bot-") ? "Remove dupes" : p.isBot ? "Return control" : "Mark as dupes"}</button>}
        </> : <><span className="seat-number">0{i + 1}</span><small>Open seat</small></>}
      </div>)}</div>
      <div className="team-legend"><span><i className="team-dot team-0" /> Team A</span><span><i className="team-dot team-1" /> Team B</span></div>
      <div className="lobby-actions">
        {players.length === 6 && <button className="primary-action lobby-start" onClick={() => send({ type: "start" })}>Start game <span>▶</span></button>}
        {canAddBots && <button className="secondary-action bot-button" onClick={() => send({ type: "add_bots" })}>◆ Fill {6 - players.length} open seat{6 - players.length > 1 ? "s" : ""} with dupes</button>}
      </div>
      {players.length > 0 && players.length < 6 && <div className="invite-box"><small>Share this link to invite players</small><code onClick={() => navigator.clipboard?.writeText(window.location.href)}>{window.location.href}</code></div>}
    </div>
  </div>;
}
