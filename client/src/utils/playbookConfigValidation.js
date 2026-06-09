const ASSIGNMENT_TYPES_REQUIRING_TARGET = new Set(['specific_user', 'role', 'team']);

export function collectPlaybookConfigWarnings(pipelines = []) {
  const warnings = [];

  for (const pipeline of pipelines) {
    const pipelineName = pipeline?.name || pipeline?.key || 'pipeline';
    const stages = Array.isArray(pipeline?.stages) ? pipeline.stages : [];

    for (const stage of stages) {
      const playbook = stage?.playbook;
      if (!playbook?.enabled) continue;

      const stageName = stage?.name || stage?.key || 'stage';
      const actions = Array.isArray(playbook.actions) ? playbook.actions : [];
      const actionKeys = new Set(actions.map((action) => action?.key).filter(Boolean));

      if (!actions.length) {
        warnings.push({
          code: 'empty_playbook',
          pipelineName,
          stageName,
          messageKey: 'settings.salesPlayWarnEmptyPlaybook',
          messageParams: { stage: stageName }
        });
      }

      if (playbook.autoAdvance && !playbook.exitCriteria?.nextStageKey) {
        warnings.push({
          code: 'auto_advance_no_target',
          pipelineName,
          stageName,
          messageKey: 'settings.salesPlayWarnAutoAdvanceNoStage',
          messageParams: { stage: stageName }
        });
      }

      if (playbook.exitCriteria?.type === 'custom') {
        const conditions = Array.isArray(playbook.exitCriteria.conditions) ? playbook.exitCriteria.conditions : [];
        const hasValidCondition = conditions.some((condition) => String(condition?.field || '').trim());
        if (!hasValidCondition) {
          warnings.push({
            code: 'custom_exit_no_conditions',
            pipelineName,
            stageName,
            messageKey: 'settings.salesPlayWarnCustomExitNoConditions',
            messageParams: { stage: stageName }
          });
        }
      }

      for (const action of actions) {
        const actionTitle = action?.title || action?.key || 'activity';

        if (ASSIGNMENT_TYPES_REQUIRING_TARGET.has(action?.assignment?.type) && !action?.assignment?.targetId) {
          warnings.push({
            code: 'assignment_missing_target',
            pipelineName,
            stageName,
            messageKey: 'settings.salesPlayWarnAssignmentTarget',
            messageParams: { stage: stageName, activity: actionTitle }
          });
        }

        if (action?.trigger?.type === 'after_action') {
          const sourceKey = String(action.trigger.sourceActionKey || '').trim();
          if (!sourceKey) {
            warnings.push({
              code: 'after_action_no_source',
              pipelineName,
              stageName,
              messageKey: 'settings.salesPlayWarnAfterActionSource',
              messageParams: { stage: stageName, activity: actionTitle }
            });
          } else if (!actionKeys.has(sourceKey)) {
            warnings.push({
              code: 'after_action_invalid_source',
              pipelineName,
              stageName,
              messageKey: 'settings.salesPlayWarnAfterActionInvalidSource',
              messageParams: { stage: stageName, activity: actionTitle }
            });
          }
        }

        const deps = Array.isArray(action.dependencies) ? action.dependencies : [];
        for (const depKey of deps) {
          if (depKey && !actionKeys.has(depKey)) {
            warnings.push({
              code: 'invalid_dependency',
              pipelineName,
              stageName,
              messageKey: 'settings.salesPlayWarnInvalidDependency',
              messageParams: { stage: stageName, activity: actionTitle }
            });
          }
        }
      }
    }
  }

  return warnings;
}
