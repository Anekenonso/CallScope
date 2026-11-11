const SCHEMA_VERSION = "v1";
function getCacheMode() {
  const kvUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const kvToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  return Boolean(kvUrl && kvToken) ? "kv" : "memory";
}
function getHealthData() {
  const servKey = process.env.SERV_API_KEY;
  const dolphinKey = process.env.DOLPHIN_API_KEY;
  const buildSha = process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || process.env.BUILD_SHA || "local";
  return {
    status: "ok",
    cacheMode: getCacheMode(),
    servConfigured: Boolean(servKey && servKey.trim().length > 0),
    dolphinConfigured: Boolean(dolphinKey && dolphinKey.trim().length > 0),
    schemaVersion: SCHEMA_VERSION,
    buildSha
  };
}
async function handler(req, res) {
  const isWebStandard = typeof Request !== "undefined" && req instanceof Request;
  const data = getHealthData();
  if (isWebStandard) {
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store, max-age=0"
      }
    });
  }
  res.setHeader("Cache-Control", "no-store, max-age=0");
  return res.status(200).json(data);
}
const GET = handler;
export {
  GET,
  handler as default,
  getHealthData
};
