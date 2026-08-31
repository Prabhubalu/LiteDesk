# Webform outbound webhooks

Webforms can POST a JSON payload to your URL when a submission is processed successfully.

## Request

- **Method:** `POST`
- **Content-Type:** `application/json`
- **Header:** `X-Arivu-Signature` (when a webhook secret is configured)

### Payload shape

```json
{
  "event": "webform.submission.processed",
  "webformId": "WFM-001",
  "webformName": "Contact Form",
  "submissionId": "665f1a2b3c4d5e6f7a8b9c0d",
  "status": "processed",
  "crmOutcome": {
    "moduleKey": "people",
    "recordId": "665f1a2b3c4d5e6f7a8b9c0e",
    "action": "created"
  },
  "dedupOutcome": {
    "matched": false,
    "matchedRecordId": null,
    "action": null
  },
  "assignmentOutcome": null,
  "submittedAt": "2026-06-16T12:00:00.000Z"
}
```

## Verifying `X-Arivu-Signature`

The signature is an **HMAC-SHA256** hex digest of the **raw JSON body** using your webhook secret.

### Node.js

```javascript
const crypto = require('crypto');

function verifyArivuWebhook(rawBody, signatureHeader, secret) {
  if (!signatureHeader || !secret) return false;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(expected, 'utf8'),
    Buffer.from(String(signatureHeader).trim(), 'utf8')
  );
}
```

Use the exact bytes received in the HTTP body (before parsing JSON) when computing the HMAC.

### Python

```python
import hmac
import hashlib

def verify_arivu_webhook(raw_body: bytes, signature_header: str, secret: str) -> bool:
    if not signature_header or not secret:
        return False
    expected = hmac.new(secret.encode(), raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature_header.strip())
```

## Retry policy

Delivery is **best-effort** with a 10s timeout. Failed deliveries are logged server-side but not automatically retried (WF6 may add a delivery log and retries).

## Security notes

- Use HTTPS endpoints only.
- Rotate webhook secrets from Settings → Webforms → Automate.
- Reject requests when the signature does not match.
- Treat payloads as untrusted input; validate fields before acting on them.
