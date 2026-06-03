import { defineHttpCase } from './httpAssert.mjs';

export const FLEX = [200, 400, 403, 404];
export const MUT = [200, 201, 400, 403];

/**
 * @param {Array<[string, string, string, number|number[]?]>} specs — [caseId, method, path, expectStatus?]
 */
export function batchHttp(specs) {
  return specs.map(([caseId, method, path, expectStatus]) =>
    defineHttpCase(caseId, {
      method,
      path,
      expectStatus: expectStatus ?? (method === 'GET' ? 200 : MUT),
    })
  );
}
