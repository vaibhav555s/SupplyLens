// ─── SupplyLens — Centralized Config ───
require('dotenv').config();

module.exports = {
  port: parseInt(process.env.PORT, 10) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  bomFilterEnabled: process.env.BOM_FILTER_ENABLED !== 'false', // Default to true unless explicitly disabled

  // API Keys
  comtradeApiKey: process.env.COMTRADE_API_KEY || '',
  openCorporatesApiKey: process.env.OPENCORPORATES_API_KEY || '',
  groqApiKey: process.env.GROQ_API_KEY || '',
  mongodbUri: process.env.MONGODB_URI || '',
  jwtSecret: process.env.JWT_SECRET || 'scxray_dev_secret_change_in_production',
  openSanctionsApiKey: process.env.OPENSANCTIONS_API_KEY || '',

  // Redis
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',

  // Cache TTLs (seconds)
  cacheTTL: {
    tradeData: 86400,       // 24h — trade records don't change fast
    entityResolution: 604800, // 7 days — company data is stable
    htsDescription: 2592000,  // 30 days — HS code descriptions rarely change
    comtrade: 86400,          // 24h
    geocode: 2592000,         // 30 days
  },

  // Rate limits (milliseconds between requests)
  rateLimits: {
    importyeti: 2000,    // 1 req / 2s
    zauba: 2000,         // 1 req / 2s
    nominatim: 1100,     // 1 req / sec (with buffer)
    comtrade: 1000,
    opencorporates: 500,
    wikidata: 500,
  },

  // Retry config
  retry: {
    maxRetries: 3,
    baseDelay: 1000,  // ms — exponential backoff base
  },
};
