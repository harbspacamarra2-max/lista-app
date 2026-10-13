module.exports = ({ config }) => ({
  ...config,
  extra: { ...(config.extra || {}), geminiKey: process.env.GEMINI_API_KEY || '' },
  experiments: { ...(config.experiments || {}), baseUrl: process.env.WEB_BASE || undefined },
});
