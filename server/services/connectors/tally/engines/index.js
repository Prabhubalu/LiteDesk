'use strict';

/**
 * ATIP engine barrel — ERP-agnostic surface with connectorKey='tally' implementations.
 */

    module.exports = {
  connectionEngine: require('./connectionEngine'),
  metadataEngine: require('./metadataEngine'),
  schemaGenerator: require('./schemaGenerator'),
  mappingEngine: require('./mappingEngine'),
  aiMappingEngine: require('./aiMappingEngine'),
  validationEngine: require('./validationEngine'),
  transformationEngine: require('./transformationEngine'),
  synchronisationEngine: require('./synchronisationEngine'),
  changeDetectionEngine: require('./changeDetectionEngine'),
  conflictEngine: require('./conflictEngine'),
  auditEngine: require('./auditEngine'),
  monitoringEngine: require('./monitoringEngine'),
  errorIntelligenceEngine: require('./errorIntelligenceEngine'),
  ruleOverlayService: require('./ruleOverlayService'),
};
