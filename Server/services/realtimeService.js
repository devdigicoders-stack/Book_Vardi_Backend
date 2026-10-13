// Server-Sent Events (SSE) Real-Time Synchronization Service
const activeClients = new Set();

/**
 * Handle SSE stream connection
 */
export const handleRealtimeStream = (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    "Connection": "keep-alive",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "*",
    "X-Accel-Buffering": "no"
  });

  res.write(`data: ${JSON.stringify({ type: "CONNECTED", timestamp: Date.now() })}\n\n`);

  activeClients.add(res);

  // Send periodic comment keepalive every 15s so connection never drops
  const keepaliveTimer = setInterval(() => {
    try {
      res.write(": keepalive\n\n");
    } catch {
      clearInterval(keepaliveTimer);
      activeClients.delete(res);
    }
  }, 15000);

  req.on("close", () => {
    clearInterval(keepaliveTimer);
    activeClients.delete(res);
  });
};

/**
 * Broadcast event to all active clients (Seller, Admin, Website)
 */
export const broadcastRealtimeEvent = (payload) => {
  if (!payload) return;
  const data = {
    ...payload,
    timestamp: payload.timestamp || Date.now()
  };
  const message = `data: ${JSON.stringify(data)}\n\n`;

  for (const client of activeClients) {
    try {
      client.write(message);
    } catch {
      activeClients.delete(client);
    }
  }
};

export const getConnectedClientsCount = () => activeClients.size;
