const crypto = require('node:crypto');

const COOKIE_NAME = 'hyper_release_session';
const SESSION_SECONDS = 8 * 60 * 60;

function safeEqual(left, right) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function sessionSignature(expiresAt) {
  const secret = process.env.SITE_SESSION_SECRET;
  if (!secret || secret.length < 32) return null;
  return crypto.createHmac('sha256', secret).update(String(expiresAt)).digest('hex');
}

function isAuthorized(req) {
  const cookieHeader = req.headers.cookie || '';
  const item = cookieHeader.split(';').map(part => part.trim()).find(part => part.startsWith(`${COOKIE_NAME}=`));
  if (!item) return false;
  const [expiresText, suppliedSignature] = item.slice(COOKIE_NAME.length + 1).split('.');
  const expiresAt = Number(expiresText);
  const expectedSignature = Number.isSafeInteger(expiresAt) && expiresAt > Math.floor(Date.now() / 1000)
    ? sessionSignature(expiresAt)
    : null;
  return Boolean(expectedSignature && suppliedSignature && safeEqual(suppliedSignature, expectedSignature));
}

function createSession() {
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
  const signature = sessionSignature(expiresAt);
  if (!signature) return null;
  return { value: `${expiresAt}.${signature}`, maxAge: SESSION_SECONDS };
}

function passwordMatches(password) {
  const expected = process.env.SITE_PASSWORD;
  if (!expected || typeof password !== 'string') return false;
  const suppliedHash = crypto.createHash('sha256').update(password).digest('hex');
  const expectedHash = crypto.createHash('sha256').update(expected).digest('hex');
  return safeEqual(suppliedHash, expectedHash);
}

function sessionCookie(req, value, maxAge) {
  const secure = process.env.VERCEL || req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : '';
  return `${COOKIE_NAME}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure}`;
}

module.exports = { COOKIE_NAME, createSession, isAuthorized, passwordMatches, sessionCookie };
