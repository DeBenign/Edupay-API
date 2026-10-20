const crypto = require('crypto');
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0, O, 1, I
const TTL_DAYS = Number(process.env.LINK_CODE_TTL_DAYS) || 30;

const generateLinkCode = () => Array.from({ length: 8 }, () => ALPHABET[crypto.randomInt(ALPHABET.length)]).join('');
const normalizeLinkCode = (input) => String(input || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const linkCodeExpiry = () => new Date(Date.now() + TTL_DAYS * 24 * 60 * 60 * 1000);
const formatLinkCode = (c) => (c ? `${c.slice(0, 4)}-${c.slice(4)}` : null);

module.exports = { generateLinkCode, normalizeLinkCode, linkCodeExpiry, formatLinkCode };