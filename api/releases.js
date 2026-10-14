const REPOSITORY = 'ashmeet-op/Hyper_Launcher_Windows';
const { isAuthorized } = require('../lib/release-auth');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed.' });
  }
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Vary', 'Cookie');
  if (!isAuthorized(req)) return res.status(401).json({ error: 'Sign in to view private releases.' });
  if (!process.env.GITHUB_TOKEN) return res.status(503).json({ error: 'Private release access is not configured.' });

  const headers = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'Hyper-Launcher-Website'
  };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

  try {
    const repository = await fetch(`https://api.github.com/repos/${REPOSITORY}`, { headers });
    if (!repository.ok) {
      return res.status(502).json({ error: 'GitHub could not provide releases right now.' });
    }
    const repositoryInfo = await repository.json();
    if (repositoryInfo.private !== true && repositoryInfo.private !== false) {
      return res.status(502).json({ error: 'GitHub returned an unexpected repository response.' });
    }

    const response = await fetch(`https://api.github.com/repos/${REPOSITORY}/releases?per_page=100`, { headers });
    if (!response.ok) {
      const rateLimited = response.status === 403 || response.status === 429;
      return res.status(rateLimited ? 503 : 502).json({
        error: rateLimited ? 'GitHub is temporarily limiting release requests. Please try again shortly.' : 'GitHub could not provide releases right now.'
      });
    }

    const releases = await response.json();
    if (!Array.isArray(releases)) throw new Error('Unexpected GitHub response');
    const publicReleases = releases.filter(release => !release.draft).map(release => ({
      tag_name: release.tag_name || '',
      name: release.name || '',
      body: release.body || '',
      published_at: release.published_at || null,
      prerelease: Boolean(release.prerelease),
      html_url: release.html_url,
      assets: Array.isArray(release.assets) ? release.assets.map(asset => ({
        id: asset.id,
        name: asset.name,
        size: asset.size,
        browser_download_url: asset.browser_download_url
      })) : []
    }));
    return res.status(200).json(publicReleases);
  } catch (_) {
    return res.status(502).json({ error: 'Unable to load releases. Check your connection and try again.' });
  }
};
