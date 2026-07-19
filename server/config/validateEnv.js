/**
 * Environment validation for production. Keep failures loud and early.
 */
function validateEnv() {
  const isProd = process.env.NODE_ENV === 'production';
  const defaultProvider = String(process.env.AI_DEFAULT_LLM_PROVIDER || 'openai').toLowerCase();
  const vectorStore = String(process.env.AI_VECTOR_STORE || 'atlas').toLowerCase();

  if (!['openai', 'azure_openai', 'anthropic', 'gemini', 'openrouter', 'nvidia', 'bedrock'].includes(defaultProvider)) {
    console.warn(`⚠️  Unknown AI_DEFAULT_LLM_PROVIDER=${defaultProvider}. AI requests will return NOT_CONFIGURED until a supported provider is selected.`);
  }

  if (!['atlas', 'mongo', 'memory', 'qdrant'].includes(vectorStore)) {
    console.warn(`⚠️  Unknown AI_VECTOR_STORE=${vectorStore}. Valid values: atlas, mongo, memory, qdrant.`);
  }
  if (vectorStore === 'atlas' && process.env.AI_ATLAS_VECTOR_INDEX === '') {
    console.warn('⚠️  AI_ATLAS_VECTOR_INDEX is empty. Atlas vector search will use the default index name.');
  }

  if (isProd) {
    if (!process.env.JWT_SECRET || String(process.env.JWT_SECRET).length < 24) {
      console.error('❌ FATAL: production requires JWT_SECRET (use a long random string, e.g. openssl rand -base64 48).');
      process.exit(1);
    }
    if (process.env.DISABLE_SECURITY === 'true') {
      console.error('❌ FATAL: DISABLE_SECURITY cannot be true in production.');
      process.exit(1);
    }
    if (process.env.RBAC_V2 === 'true' || process.env.SHARING_V1 === 'true') {
      console.warn(
        '⚠️  RBAC_V2 and/or SHARING_V1 are enabled globally. Prefer per-org flags until migration is complete.'
      );
    }
    if (process.env.PORTAL_FRAMEWORK_V1 === 'true') {
      console.warn(
        '⚠️  PORTAL_FRAMEWORK_V1 is enabled globally. Prefer per-org portalFrameworkV1Enabled until cutover.'
      );
    }
    if (defaultProvider === 'openai' && !process.env.OPENAI_API_KEY && !process.env.AI_OPENAI_API_KEY) {
      console.warn('⚠️  OpenAI is the default AI provider but OPENAI_API_KEY / AI_OPENAI_API_KEY is not set. Platform-key AI will return NOT_CONFIGURED.');
    }
    if (defaultProvider === 'openrouter' && !process.env.OPENROUTER_API_KEY && !process.env.AI_OPENROUTER_API_KEY) {
      console.warn('⚠️  OpenRouter is the default AI provider but OPENROUTER_API_KEY / AI_OPENROUTER_API_KEY is not set. Platform-key AI will return NOT_CONFIGURED.');
    }
    if (defaultProvider === 'nvidia' && !process.env.NVIDIA_API_KEY && !process.env.AI_NVIDIA_API_KEY) {
      console.warn('⚠️  NVIDIA is the default AI provider but NVIDIA_API_KEY / AI_NVIDIA_API_KEY is not set. Platform-key AI will return NOT_CONFIGURED.');
    }
    if (vectorStore === 'atlas' && !process.env.AI_ATLAS_VECTOR_INDEX) {
      console.warn('⚠️  AI_VECTOR_STORE=atlas uses Atlas Vector Search index ai_vector_chunks_embedding by default. Set AI_ATLAS_VECTOR_INDEX if your index uses another name.');
    }
  }
}

module.exports = { validateEnv };
