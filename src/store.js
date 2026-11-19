// Store en memoria con TTL. Suficiente para este caso de uso (sesiones cortas).
// Si un día necesitas persistencia, se cambia por Redis sin tocar los handlers.

const TTL_MS = 30 * 60 * 1000;       // 30 min por sesión
const SWEEP_MS = 5 * 60 * 1000;      // limpieza cada 5 min

const sessions = new Map();
// key: sessionId
// value: { stage: 'payment'|'otp', decision: string|null, messageId?: number, createdAt: number, expiresAt: number }

function ensure(sessionId, stage) {
  const now = Date.now();
  const prev = sessions.get(sessionId);
  if (prev) {
    prev.stage = stage;
    prev.decision = null;
    prev.expiresAt = now + TTL_MS;
    return prev;
  }
  const fresh = { stage, decision: null, messageId: null, createdAt: now, expiresAt: now + TTL_MS };
  sessions.set(sessionId, fresh);
  return fresh;
}

function setMessageId(sessionId, messageId) {
  const s = sessions.get(sessionId);
  if (s) s.messageId = messageId;
}

function setDecision(sessionId, decision) {
  const s = sessions.get(sessionId);
  if (!s) return false;
  s.decision = decision;
  s.expiresAt = Date.now() + TTL_MS;
  return true;
}

function get(sessionId) {
  const s = sessions.get(sessionId);
  if (!s) return null;
  if (Date.now() > s.expiresAt) {
    sessions.delete(sessionId);
    return null;
  }
  return s;
}

function sweep() {
  const now = Date.now();
  let removed = 0;
  for (const [k, v] of sessions.entries()) {
    if (now > v.expiresAt) {
      sessions.delete(k);
      removed++;
    }
  }
  if (removed > 0) console.log(`[store] sweep: ${removed} sesiones expiradas`);
}

setInterval(sweep, SWEEP_MS).unref();

function size() { return sessions.size; }

module.exports = { ensure, setMessageId, setDecision, get, size };
