// Seed the live invoice rate card with the owner-confirmed hourly rate.
// Creates server/data/invoice-rate-card.json if missing; never deletes anything.
const fs = require('fs');
const path = require('path');
const { _paths } = require('/home/ghost/haksterAi/server/src/telegramInvoiceBot.js');

const before = fs.existsSync(_paths.RATE_CARD) ? fs.readFileSync(_paths.RATE_CARD, 'utf8') : null;
console.log('existed_before:', before !== null);
console.log('path:', _paths.RATE_CARD);
