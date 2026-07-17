class AiConfigurationError extends Error {
  constructor(message, code = 'AI_NOT_CONFIGURED') {
    super(message);
    this.name = 'AiConfigurationError';
    this.code = code;
    this.statusCode = 400;
  }
}

class AiProviderError extends Error {
  constructor(message, code = 'AI_PROVIDER_ERROR', statusCode = 502) {
    super(message);
    this.name = 'AiProviderError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

module.exports = {
  AiConfigurationError,
  AiProviderError,
};
