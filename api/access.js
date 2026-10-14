const { createSession, isAuthorized, passwordMatches, sessionCookie } = require('../lib/release-auth');

module.exports = (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Vary', 'Cookie');

  if (req.method === 'GET') return res.status(200).json({ authenticated: isAuthorized(req) });

  if (req.method === 'DELETE') {
    res.setHeader('Set-Cookie', sessionCookie(req, '', 0));
    return res.status(200).json({ authenticated: false });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST, DELETE');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const origin = req.headers.origin;
  const host = req.headers.host;
  if (origin && host) {
    try {
      if (new URL(origin).host !== host) return res.status(403).json({ error: 'Sign-in request rejected.' });
    } catch (_) {
      return res.status(403).json({ error: 'Sign-in request rejected.' });
    }
  }

  if (!process.env.SITE_PASSWORD || process.env.SITE_PASSWORD.length < 12 ||
      !process.env.SITE_SESSION_SECRET || process.env.SITE_SESSION_SECRET.length < 32) {
    return res.status(503).json({ error: 'Private release access is not configured.' });
  }
  if (!passwordMatches(req.body && req.body.password)) {
    return res.status(401).json({ error: 'Incorrect access password.' });
  }

  const session = createSession();
  if (!session) return res.status(503).json({ error: 'Private release access is not configured.' });
  res.setHeader('Set-Cookie', sessionCookie(req, session.value, session.maxAge));
  return res.status(200).json({ authenticated: true });
};
