const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const path = require('path');

// =============================================
//           KONFIGURASI BOT
// =============================================
const TOKEN = '8735957136:AAGmxa88cvKmlcdC0uLTl8Iz7r463RDV_oE';
const OWNER_ID = 7326526945;

const bot = new TelegramBot(TOKEN, { polling: true });

// =============================================
//           DATABASE.JSON — AUTO LOAD / CREATE
// =============================================
const DB_PATH = path.join(__dirname, 'database.json');

const DEFAULT_DB = {
  freePred: '',
  premPred: '',
  premiumUsers: [],
  totalUsers: []
};

function loadDB() {
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify(DEFAULT_DB, null, 2), 'utf-8');
    console.log('📁 database.json dibuat baru.');
    return { ...DEFAULT_DB };
  }
  try {
    const raw = fs.readFileSync(DB_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    console.log('📂 database.json ditemukan, data dimuat.');
    return {
      freePred: parsed.freePred || '',
      premPred: parsed.premPred || '',
      premiumUsers: Array.isArray(parsed.premiumUsers) ? parsed.premiumUsers : [],
      totalUsers: Array.isArray(parsed.totalUsers) ? parsed.totalUsers : []
    };
  } catch (err) {
    console.error('❌ Gagal baca database.json, reset ke default:', err.message);
    fs.writeFileSync(DB_PATH, JSON.stringify(DEFAULT_DB, null, 2), 'utf-8');
    return { ...DEFAULT_DB };
  }
}

function saveDB() {
  const data = {
    freePred: db.freePred,
    premPred: db.premPred,
    premiumUsers: [...db.premiumUsers],
    totalUsers: [...db.totalUsers]
  };
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

const loaded = loadDB();
const db = {
  freePred: loaded.freePred,
  premPred: loaded.premPred,
  premiumUsers: new Set(loaded.premiumUsers),
  totalUsers: new Set(loaded.totalUsers)
};

// =============================================
//           HELPER FUNCTIONS
// =============================================

function getWIBDateTime() {
  const now = new Date();
  const options = {
    timeZone: 'Asia/Jakarta',
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  };
  return now.toLocaleString('id-ID', options) + ' WIB';
}

function isOwner(userId) {
  return userId === OWNER_ID;
}

function isPremium(userId) {
  return db.premiumUsers.has(userId);
}

// Catat user ke totalUsers setiap ada interaksi
function trackUser(userId) {
  if (!db.totalUsers.has(userId)) {
    db.totalUsers.add(userId);
    saveDB();
  }
}

function formatPredLines(rawText) {
  const lines = rawText
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.startsWith('-'));

  if (lines.length === 0) return null;

  return lines
    .map(line => {
      const clean = line.replace(/^-\s*/, '').trim();
      const parts = clean.split(':');
      if (parts.length < 2) return `🎯 ${clean}`;

      const matchup = parts[0].trim();
      const winner = parts[1].trim();
      const teams = matchup.split('VS').map(t => t.trim());

      if (teams.length === 2) {
        const teamA = teams[0];
        const teamB = teams[1];
        const winnerUpper = winner.toUpperCase();
        const teamAUpper = teamA.toUpperCase();

        const emojiA = winnerUpper === teamAUpper ? '✅' : '❌';
        const emojiB = winnerUpper !== teamAUpper ? '✅' : '❌';

        return (
          `┌─────────────────────────\n` +
          `│ ⚔️  ${teamA}  VS  ${teamB}\n` +
          `│ ${emojiA} ${teamA}   ${emojiB} ${teamB}\n` +
          `│ 🏆 Prediksi: *${winner}*\n` +
          `└─────────────────────────`
        );
      }

      return `🎯 ${clean} → *${winner}*`;
    })
    .join('\n\n');
}

// =============================================
//           COMMAND: /start
// =============================================
bot.onText(/\/start/, (msg) => {
  const name = msg.from.first_name || 'User';
  trackUser(msg.from.id);
  bot.sendMessage(
    msg.chat.id,
    `👋 Halo, *${name}!* Selamat datang di *BOT PREDIK* 🎯\n\n` +
    `📋 *Daftar Command:*\n\n` +
    `🆓 /freepred — Prediksi gratis terbaru\n` +
    `👑 /premiumpred — Prediksi eksklusif premium\n` +
    `📊 /mystatus — Cek status akun kamu\n` +
    `📖 /help — Bantuan lengkap\n\n` +
    `_Daftarkan dirimu sebagai premium untuk akses prediksi tergacor!_`,
    { parse_mode: 'Markdown' }
  );
});

// =============================================
//           COMMAND: /freepred
// =============================================
bot.onText(/\/freepred/, (msg) => {
  const chatId = msg.chat.id;
  trackUser(msg.from.id);
  const time = getWIBDateTime();

  if (!db.freePred) {
    return bot.sendMessage(
      chatId,
      `⏳ *Prediksi gratis belum tersedia.*\n\nTunggu update dari owner ya! 🙏`,
      { parse_mode: 'Markdown' }
    );
  }

  const formatted = formatPredLines(db.freePred);
  bot.sendMessage(
    chatId,
    `🆓 *FREE PREDICTION — TERBARU*\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `${formatted}\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `🕐 *Update:* ${time}\n\n` +
    `_Mau prediksi lebih gacor & fix win? Upgrade ke 👑 PREMIUM!_`,
    { parse_mode: 'Markdown' }
  );
});

// =============================================
//           COMMAND: /premiumpred
// =============================================
bot.onText(/\/premiumpred/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  trackUser(userId);
  const time = getWIBDateTime();

  if (!isPremium(userId) && !isOwner(userId)) {
    return bot.sendMessage(
      chatId,
      `🔒 *Akses Ditolak!*\n\n` +
      `Command ini hanya untuk pengguna 👑 *PREMIUM*.\n\n` +
      `Hubungi owner untuk mendapatkan akses premium!`,
      { parse_mode: 'Markdown' }
    );
  }

  if (!db.premPred) {
    return bot.sendMessage(
      chatId,
      `⏳ *Prediksi premium belum tersedia.*\n\nTunggu update dari owner ya! 🙏`,
      { parse_mode: 'Markdown' }
    );
  }

  const formatted = formatPredLines(db.premPred);
  bot.sendMessage(
    chatId,
    `👑 *PREMIUM PREDICTION — EKSKLUSIF*\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `${formatted}\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `🕐 *Update:* ${time}\n\n` +
    `_Prediksi ini hanya untuk member premium terpilih. 🔥_`,
    { parse_mode: 'Markdown' }
  );
});

// =============================================
//           COMMAND: /setfreepred (OWNER ONLY)
// =============================================
bot.onText(/\/setfreepred([\s\S]*)/, (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  if (!isOwner(userId)) {
    return bot.sendMessage(chatId, `🚫 Kamu tidak punya akses command ini.`);
  }

  const input = match[1].trim();

  if (!input) {
    return bot.sendMessage(
      chatId,
      `⚠️ *Format salah!*\n\nContoh penggunaan:\n\`\`\`\n/setfreepred\n- KEVIN VS MIKZ : KEVIN\n- ANDRA VS KENZ : KENZ\n\`\`\``,
      { parse_mode: 'Markdown' }
    );
  }

  db.freePred = input;
  saveDB();

  const time = getWIBDateTime();
  bot.sendMessage(
    chatId,
    `✅ *Free Prediction berhasil diperbarui!*\n\n` +
    `🕐 ${time}\n` +
    `💾 _Data tersimpan di database.json_\n\n` +
    `_User dapat melihatnya dengan /freepred_`,
    { parse_mode: 'Markdown' }
  );
});

// =============================================
//           COMMAND: /setprempred (OWNER ONLY)
// =============================================
bot.onText(/\/setprempred([\s\S]*)/, (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  if (!isOwner(userId)) {
    return bot.sendMessage(chatId, `🚫 Kamu tidak punya akses command ini.`);
  }

  const input = match[1].trim();

  if (!input) {
    return bot.sendMessage(
      chatId,
      `⚠️ *Format salah!*\n\nContoh penggunaan:\n\`\`\`\n/setprempred\n- KEVIN VS MIKZ : KEVIN\n- ANDRA VS KENZ : KENZ\n\`\`\``,
      { parse_mode: 'Markdown' }
    );
  }

  db.premPred = input;
  saveDB();

  const time = getWIBDateTime();
  bot.sendMessage(
    chatId,
    `✅ *Premium Prediction berhasil diperbarui!*\n\n` +
    `🕐 ${time}\n` +
    `💾 _Data tersimpan di database.json_\n\n` +
    `_User premium dapat melihatnya dengan /premiumpred_`,
    { parse_mode: 'Markdown' }
  );
});

// =============================================
//           COMMAND: /setprem (OWNER ONLY)
// =============================================
bot.onText(/\/setprem(?:\s+(\d+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  if (!isOwner(userId)) {
    return bot.sendMessage(chatId, `🚫 Kamu tidak punya akses command ini.`);
  }

  const targetId = match[1] ? parseInt(match[1]) : null;

  if (!targetId) {
    return bot.sendMessage(
      chatId,
      `⚠️ *Format salah!*\n\nCara penggunaan:\n\`/setprem <id_user>\`\n\nContoh: \`/setprem 123456789\``,
      { parse_mode: 'Markdown' }
    );
  }

  if (db.premiumUsers.has(targetId)) {
    return bot.sendMessage(
      chatId,
      `ℹ️ User dengan ID \`${targetId}\` sudah menjadi *PREMIUM*.`,
      { parse_mode: 'Markdown' }
    );
  }

  db.premiumUsers.add(targetId);
  db.totalUsers.add(targetId);
  saveDB();

  bot.sendMessage(
    chatId,
    `✅ *Berhasil!*\n\nUser \`${targetId}\` sekarang adalah 👑 *PREMIUM*.\n💾 _Tersimpan di database.json_`,
    { parse_mode: 'Markdown' }
  );

  try {
    await bot.sendMessage(
      targetId,
      `🎉 *Selamat!*\n\n` +
      `Kamu telah menjadi 👑 *PREMIUM USER!*\n\n` +
      `Sekarang kamu bisa mengakses prediksi eksklusif dengan command:\n` +
      `👉 /premiumpred\n\n` +
      `Terima kasih sudah bergabung! 🔥`,
      { parse_mode: 'Markdown' }
    );
  } catch (err) {
    bot.sendMessage(
      chatId,
      `⚠️ Status premium berhasil ditambahkan, tapi gagal mengirim notifikasi ke user (mungkin belum pernah start bot).`
    );
  }
});

// =============================================
//           COMMAND: /removeprem (OWNER ONLY)
// =============================================
bot.onText(/\/removeprem(?:\s+(\d+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  if (!isOwner(userId)) {
    return bot.sendMessage(chatId, `🚫 Kamu tidak punya akses command ini.`);
  }

  const targetId = match[1] ? parseInt(match[1]) : null;

  if (!targetId) {
    return bot.sendMessage(
      chatId,
      `⚠️ *Format salah!*\n\nCara: \`/removeprem <id_user>\``,
      { parse_mode: 'Markdown' }
    );
  }

  if (!db.premiumUsers.has(targetId)) {
    return bot.sendMessage(
      chatId,
      `ℹ️ User \`${targetId}\` bukan premium user.`,
      { parse_mode: 'Markdown' }
    );
  }

  db.premiumUsers.delete(targetId);
  saveDB();

  bot.sendMessage(
    chatId,
    `✅ Premium user \`${targetId}\` telah *dihapus*.\n💾 _Database diperbarui_`,
    { parse_mode: 'Markdown' }
  );

  try {
    await bot.sendMessage(
      targetId,
      `⚠️ Status 👑 *PREMIUM* kamu telah *dicabut* oleh owner.`,
      { parse_mode: 'Markdown' }
    );
  } catch (_) {}
});

// =============================================
//           COMMAND: /listprem (OWNER ONLY)
// =============================================
bot.onText(/\/listprem/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  if (!isOwner(userId)) {
    return bot.sendMessage(chatId, `🚫 Kamu tidak punya akses command ini.`);
  }

  if (db.premiumUsers.size === 0) {
    return bot.sendMessage(chatId, `📋 Belum ada user premium saat ini.`);
  }

  const list = [...db.premiumUsers]
    .map((id, i) => `${i + 1}. \`${id}\``)
    .join('\n');

  bot.sendMessage(
    chatId,
    `👑 *Daftar Premium User (${db.premiumUsers.size})*\n\n${list}`,
    { parse_mode: 'Markdown' }
  );
});

// =============================================
//           COMMAND: /p — Statistik User
// =============================================
bot.onText(/\/p/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  trackUser(userId);

  const totalPrem = db.premiumUsers.size;
  const totalAll = db.totalUsers.size;
  const totalFree = totalAll - totalPrem;
  const time = getWIBDateTime();

  bot.sendMessage(
    chatId,
    `📊 *STATISTIK USER BOT*\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `👑 *Premium :* ${totalPrem} user\n` +
    `🆓 *Free    :* ${totalFree} user\n` +
    `👥 *Total   :* ${totalAll} user\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `🕐 ${time}`,
    { parse_mode: 'Markdown' }
  );
});

// =============================================
//           COMMAND: /mystatus
// =============================================
bot.onText(/\/mystatus/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const name = msg.from.first_name || 'User';
  trackUser(userId);
  const time = getWIBDateTime();

  let statusText = '';
  let roleEmoji = '';

  if (isOwner(userId)) {
    roleEmoji = '👑';
    statusText = `*OWNER*`;
  } else if (isPremium(userId)) {
    roleEmoji = '👑';
    statusText = `*PREMIUM*`;
  } else {
    roleEmoji = '🆓';
    statusText = `*FREE USER*`;
  }

  bot.sendMessage(
    chatId,
    `📊 *STATUS AKUN KAMU*\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `👤 *Nama:* ${name}\n` +
    `🆔 *ID:* \`${userId}\`\n` +
    `${roleEmoji} *Role:* ${statusText}\n\n` +
    `🕐 *Waktu Sekarang:*\n` +
    `📅 ${time}\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    ((!isPremium(userId) && !isOwner(userId))
      ? `_Belum premium? Hubungi owner untuk upgrade! 🚀_`
      : `_Nikmati akses penuh bot prediksi! 🔥_`),
    { parse_mode: 'Markdown' }
  );
});

// =============================================
//           COMMAND: /help
// =============================================
bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  trackUser(userId);

  let ownerCmds = '';
  if (isOwner(userId)) {
    ownerCmds =
      `\n\n🔑 *OWNER COMMANDS:*\n` +
      `/setfreepred — Set prediksi gratis\n` +
      `/setprempred — Set prediksi premium\n` +
      `/setprem <id> — Beri status premium ke user\n` +
      `/removeprem <id> — Cabut status premium user\n` +
      `/listprem — Lihat daftar premium user\n` +
      `/p — Statistik total user`;
  }

  bot.sendMessage(
    chatId,
    `📖 *DAFTAR COMMAND BOT PREDIKSI*\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `*SEMUA USER:*\n` +
    `/start — Mulai bot\n` +
    `/freepred — Prediksi gratis terbaru\n` +
    `/premiumpred — Prediksi premium (👑 Premium only)\n` +
    `/mystatus — Cek status & waktu WIB\n` +
    `/p — Statistik user\n` +
    `/help — Tampilkan bantuan` +
    ownerCmds,
    { parse_mode: 'Markdown' }
  );
});

// =============================================
//           ERROR HANDLER
// =============================================
bot.on('polling_error', (err) => {
  console.error('[POLLING ERROR]', err.message);
});

bot.on('error', (err) => {
  console.error('[BOT ERROR]', err.message);
});

// =============================================
//           START MESSAGE
// =============================================
console.log('╔══════════════════════════════════╗');
console.log('║      🎯 BOT PREDIKSI AKTIF 🎯    ║');
console.log('╚══════════════════════════════════╝');
console.log(`✅ Bot berjalan...`);
console.log(`👑 Owner ID  : ${OWNER_ID}`);
console.log(`👥 Premium   : ${db.premiumUsers.size} user`);
console.log(`👤 Total     : ${db.totalUsers.size} user`);
console.log(`🕐 Waktu WIB : ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
