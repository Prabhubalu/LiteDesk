# k6 (optional heavy load)

ATP built-in load uses Node (`runner/lib/loadTest.mjs`) for PR-adjacent smokes.

For stress/soak:

1. Install [k6](https://k6.io/docs/get-started/installation/)
2. Add scripts here, e.g. `health-ready.js`, targeting `ATP_SUT_API_URL`
3. Run: `k6 run load/k6/health-ready.js`

Do not commit secrets; use env vars aligned with `atp/.env`.
