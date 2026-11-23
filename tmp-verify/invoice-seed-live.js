// Create the live invoice rate card via the bot's own loader (canonical schema).
// Owner-confirmed: hourly $100 (junkalot AGENTS.md). Difficulty multipliers stay
// null — they are the owner's to set, never invented.
const fs = require('fs');
const Module = require('module');

const origLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === './telegramSiteKeys') return { isOwnerChat: () => true, ownerUser: () => null };
  return origLoad.apply(this, arguments);
};

const { handleInvoiceCommand, _paths } = require('/home/ghost/haksterAi/server/src/telegramInvoiceBot.js');

(async () => {
  console.log('existed_before:', fs.existsSync(_paths.RATE_CARD));
  const out = [];
  await handleInvoiceCommand({ text: '/rates', chatId: 1, bot: { sendMessage: async (_c, t) => { out.push(t); return {}; } } });
  const card = JSON.parse(fs.readFileSync(_paths.RATE_CARD, 'utf8'));
  console.log('hourly:', card.rates.hourly);
  console.log('difficulty:', JSON.stringify(card.difficulty));
  console.log('keys:', Object.keys(card.rates).length);
  console.log(out[0].split('\n').filter(l => /hourly|normal|hard|critical/.test(l)).join('\n'));
})().catch(e => { console.error('FAIL', e); process.exit(1); });
