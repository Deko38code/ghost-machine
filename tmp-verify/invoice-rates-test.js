// Offline check of the invoice desk rate card + difficulty rule.
// Writes only into a temp dir (HAKSTER_INVOICE_DIR), never server/data.
const fs = require('fs');
const path = require('path');
const os = require('os');
const Module = require('module');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'inv-rates-'));
process.env.HAKSTER_INVOICE_DIR = dir;

const origLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === './telegramSiteKeys') {
    return { isOwnerChat: () => true, ownerUser: () => null };
  }
  return origLoad.apply(this, arguments);
};

const { handleInvoiceCommand, _paths } = require('/home/ghost/haksterAi/server/src/telegramInvoiceBot.js');

const said = [];
const bot = { sendMessage: async (_chat, text) => { said.push(text); return { message_id: said.length }; } };
const chatId = 1;

async function run(text) {
  said.length = 0;
  const handled = await handleInvoiceCommand({ text, chatId, bot });
  return { handled, out: said.join('\n---\n') };
}

(async () => {
  const results = {};
  results.rates = await run('/rates');
  results.quoteNoTier = await run('/quote hourly 8');
  results.quoteHardUnset = await run('/quote hourly 8 hard');
  results.setHard = await run('/difficulty hard 1.5');
  results.badTier = await run('/difficulty insane 2');
  results.badMult = await run('/difficulty hard 0.5');
  results.quoteHard = await run('/quote hourly 8 hard');
  results.quoteNormalUnset = await run('/quote hourly 8 normal');

  const card = JSON.parse(fs.readFileSync(_paths.RATE_CARD, 'utf8'));
  console.log(JSON.stringify({ results, cardHourly: card.rates.hourly, difficulty: card.difficulty }, null, 2));
})().catch(e => { console.error('FAIL', e); process.exit(1); });
