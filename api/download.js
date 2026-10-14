const REPOSITORY = 'ashmeet-op/Hyper_Launcher_Windows';

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed.' });
  }
  if (!process.env.GITHUB_TOKEN) return res.status(503).json({ error: 'GitHub download access is not configured.' });

  const assetId = String(req.query && req.query.asset || '');
  if (!/^\d{1,20}$/.test(assetId)) return res.status(400).json({ error: 'Invalid release asset.' });

  const headers = {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'Hyper-Launcher-Website'
  };

  try {
    // Only allow assets attached to published releases of this fixed repository.
    const releasesResponse = await fetch(`https://api.github.com/repos/${REPOSITORY}/releases?per_page=100`, { headers });
    if (!releasesResponse.ok) return res.status(502).json({ error: 'GitHub could not provide the download.' });
    const releases = await releasesResponse.json();
    const publishedAsset = Array.isArray(releases) && releases
      .filter(release => !release.draft)
      .flatMap(release => Array.isArray(release.assets) ? release.assets : [])
      .find(asset => String(asset.id) === assetId);
    if (!publishedAsset) return res.status(404).json({ error: 'Release asset not found.' });

    const fileResponse = await fetch(`https://api.github.com/repos/${REPOSITORY}/releases/assets/${assetId}`, {
      headers: { ...headers, Accept: 'application/octet-stream' }
    });
    if (!fileResponse.ok || !fileResponse.body) return res.status(502).json({ error: 'GitHub could not provide the download.' });
    const downloadHost = new URL(fileResponse.url).hostname;
    if (downloadHost !== 'github.com' && !downloadHost.endsWith('.githubusercontent.com')) {
      return res.status(502).json({ error: 'GitHub returned an invalid download response.' });
    }
    if ((fileResponse.headers.get('content-type') || '').includes('application/json')) {
      return res.status(502).json({ error: 'GitHub did not return a release file.' });
    }

    const { Readable } = require('node:stream');
    res.setHeader('Content-Type', fileResponse.headers.get('content-type') || 'application/octet-stream');
    const length = fileResponse.headers.get('content-length');
    if (length) res.setHeader('Content-Length', length);
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(publishedAsset.name || 'download')}`);
    return Readable.fromWeb(fileResponse.body).pipe(res);
  } catch (_) {
    return res.status(502).json({ error: 'Unable to start the download. Please try again.' });
  }
};
