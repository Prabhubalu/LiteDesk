/**
 * Multi-step E2E flow helpers — shared ctx.store across steps in one case or sequential suite.
 */

/**
 * @param {string} caseId
 * @param {Array<{ name: string, run: (ctx: import('../context.mjs').RunContext) => Promise<void> }>} steps
 */
export function defineE2eFlow(caseId, steps) {
  return {
    caseId,
    async run(ctx) {
      ctx.store.e2eFlow = caseId;
      for (const step of steps) {
        ctx.store.e2eStep = step.name;
        await step.run(ctx);
      }
    },
  };
}

/**
 * @param {import('../context.mjs').RunContext} ctx
 * @param {string} stepName
 * @param {(ctx: import('../context.mjs').RunContext) => Promise<void>} fn
 */
export async function e2eStep(ctx, stepName, fn) {
  ctx.store.e2eStep = stepName;
  await fn(ctx);
}
