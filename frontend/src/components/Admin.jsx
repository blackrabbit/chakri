import React, { useState, useEffect, useCallback } from "react";

export default function Admin() {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  const fetchRooms = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await fetch("/api/admin/rooms");
      const data = await resp.json();
      setRooms(data.rooms || []);
    } catch (e) {
      setMessage("Failed to fetch rooms: " + e.message);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  async function killRoom(roomId) {
    if (!confirm(`Kill room "${roomId}"? This will disconnect all players and delete all game state.`)) return;
    try {
      const resp = await fetch(`/api/admin/kill/${roomId}`, { method: "DELETE" });
      if (resp.ok) {
        setMessage(`Room ${roomId} killed.`);
        await fetchRooms();
      } else {
        setMessage(`Failed to kill room ${roomId}.`);
      }
    } catch (e) {
      setMessage("Error: " + e.message);
    }
    setTimeout(() => setMessage(null), 3000);
  }

  async function killAll() {
    if (!confirm(`Kill ALL ${rooms.length} rooms? This will disconnect everyone and delete all game state.`)) return;
    for (const room of rooms) {
      try {
        await fetch(`/api/admin/kill/${room.id}`, { method: "DELETE" });
      } catch {}
    }
    setMessage("All rooms killed.");
    await fetchRooms();
    setTimeout(() => setMessage(null), 3000);
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--felt-dark)",
        color: "var(--text)",
        padding: "40px 20px",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      <div style={{ maxWidth: "800px", margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
          <h1 style={{ color: "var(--gold)", fontSize: "2rem" }}>
            ♠ Chakri Admin
          </h1>
          <div style={{ display: "flex", gap: "12px" }}>
            <button
              onClick={fetchRooms}
              disabled={loading}
              style={{
                padding: "8px 20px",
                borderRadius: "8px",
                border: "none",
                fontWeight: "bold",
                cursor: "pointer",
                background: "var(--team-a)",
                color: "white",
              }}
            >
              {loading ? "Loading..." : "↻ Refresh"}
            </button>
            {rooms.length > 0 && (
              <button
                onClick={killAll}
                style={{
                  padding: "8px 20px",
                  borderRadius: "8px",
                  border: "none",
                  fontWeight: "bold",
                  cursor: "pointer",
                  background: "#e0654a",
                  color: "white",
                }}
              >
                Kill All
              </button>
            )}
            <a href="/" style={{
              padding: "8px 20px",
              borderRadius: "8px",
              border: "none",
              fontWeight: "bold",
              cursor: "pointer",
              background: "#444",
              color: "white",
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
            }}>
              ← Home
            </a>
          </div>
        </div>

        {message && (
          <div style={{
            background: "rgba(212,175,55,0.2)",
            border: "1px solid var(--gold)",
            padding: "10px 16px",
            borderRadius: "8px",
            marginBottom: "16px",
            fontSize: "0.9rem",
          }}>
            {message}
          </div>
        )}

        {rooms.length === 0 ? (
          <div style={{
            textAlign: "center",
            padding: "60px",
            color: "var(--text-dim)",
            fontSize: "1.1rem",
          }}>
            {loading ? "Loading rooms..." : "No active rooms."}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {rooms.map((room) => (
              <div
                key={room.id}
                style={{
                  background: "rgba(0,0,0,0.4)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "12px",
                  padding: "16px 20px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <div style={{ fontSize: "1.1rem", marginBottom: "4px" }}>
                    <span style={{ color: "var(--gold)", fontFamily: "monospace" }}>{room.id}</span>
                    <span style={{
                      marginLeft: "10px",
                      padding: "2px 8px",
                      borderRadius: "4px",
                      fontSize: "0.75rem",
                      background: room.phase === "playing" ? "var(--team-a)" : room.phase === "bidding" ? "var(--gold)" : "#444",
                      color: room.phase === "bidding" ? "#333" : "white",
                    }}>
                      {room.phase || "empty"}
                    </span>
                  </div>
                  <div style={{ fontSize: "0.8rem", color: "var(--text-dim)" }}>
                    {room.players?.length || 0} players
                    {room.handNumber > 0 && ` · Hand ${room.handNumber}`}
                    {room.scores && ` · Team A: ${room.scores[0]} | Team B: ${room.scores[1]}`}
                  </div>
                  {room.players && room.players.length > 0 && (
                    <div style={{ fontSize: "0.75rem", color: "var(--text-dim)", marginTop: "4px" }}>
                      {room.players.map((p, i) => (
                        <span key={i} style={{
                          marginRight: "6px",
                          color: p.team === 0 ? "var(--team-a)" : "var(--team-b)",
                          opacity: p.connected ? 1 : 0.5,
                        }}>
                          {p.connected ? "●" : "○"} {p.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => killRoom(room.id)}
                  style={{
                    padding: "8px 20px",
                    borderRadius: "8px",
                    border: "none",
                    fontWeight: "bold",
                    cursor: "pointer",
                    background: "#e0654a",
                    color: "white",
                    whiteSpace: "nowrap",
                  }}
                >
                  Kill
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
