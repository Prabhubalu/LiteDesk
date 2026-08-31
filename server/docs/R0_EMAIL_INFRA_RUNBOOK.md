# R0 — Email infrastructure & routing runbook

Operator guide for blueprint **Phase R0**: central reply routing, system vs CRM send paths, and DNS security.

**Code references:** `runtimeConfigResolver.js`, `inboundEmailController.inboundHealth`, `replyToTokenService.js`.

---

## 1. Domain layout (recommended)

| Purpose | Host | Example |
|---------|------|---------|
| Frontend | `app.<domain>` | `app.arivusystems.com` |
| API | `api.<domain>` | `api.arivusystems.com` |
| Reply routing | `reply.<domain>` | `reply.arivusystems.com` |
| System outbound | `mail.<domain>` | `mail.arivusystems.com` |

Arivu Reply-To tokens use local part **`replies+{payload}.{signature}`** (also accepts blueprint alias **`reply+`** on inbound decode).

---

## 2. Central routing inbox (R0.1–R0.3)

### Google Workspace setup

1. Create mailbox **`inbox@reply.<domain>`** (humans never use it for reading mail).
2. Enable **catch-all** (or routing rules) so any `reply+*@reply.<domain>` and `replies+*@reply.<domain>` delivers to that mailbox.
3. Forward or relay raw MIME to Arivu:
   - **Option A:** Workspace → Apps Script / relay → `POST https://api.<domain>/api/webhooks/email/inbound`
   - **Option B:** SES receiving → SNS → Lambda → webhook (see `docs/PHASE2_INBOUND_SETUP.md`)
   - **Option C:** Third-party inbound parser that POSTs raw MIME

### Webhook authentication

```bash
openssl rand -hex 32   # EMAIL_INBOUND_WEBHOOK_SECRET
```

Set on API server:

```env
EMAIL_INBOUND_WEBHOOK_SECRET=<secret>
```

Relay must send:

```http
Authorization: Bearer <secret>
```

or

```http
X-Email-Inbound-Webhook-Token: <secret>
```

### Tenant routing (no shared data)

- **Do not** rely on `X-Organization-Id` for production catch-all (optional for dev).
- Every customer reply must hit a **valid token** in To/Cc/Bcc.

Production hardening:

```env
EMAIL_INBOUND_REQUIRE_REPLY_TOKEN=true
```

### Health check

```bash
curl -s https://api.<domain>/api/webhooks/email/inbound/health | jq
```

Expect `replyTokenSecretConfigured: true`, `webhookSecretConfigured: true` in production.

---

## 3. Environment matrix (R0.6–R0.7)

### System mail (notifications, OTP, password reset)

Uses **`SYSTEM_EMAIL_*`** — defaults to **OCI Email Delivery**, ignores tenant CRM SMTP integration.

```env
SYSTEM_EMAIL_PROVIDER=oci-email-delivery
SYSTEM_EMAIL_FROM=noreply@mail.arivusystems.com
SYSTEM_EMAIL_FROM_NAME=Arivu Systems
SYSTEM_OCI_EMAIL_REGION=us-phoenix-1
SYSTEM_SMTP_USER=<oci_smtp_username>
SYSTEM_SMTP_PASS=<oci_smtp_password>
# Optional overrides (else OCI_EMAIL_REGION / SMTP_*)
```

### CRM / agent mail (record + inbox compose until R2)

Uses tenant **Integrations → Email provider** + `EMAIL_PROVIDER` / `SMTP_*` / SES.

```env
EMAIL_PROVIDER=resend
EMAIL_FROM=support@arivusystems.com
# ... existing CRM vars
```

### Reply routing secrets

```env
EMAIL_REPLY_TOKEN_SECRET=<openssl rand -hex 32>
EMAIL_REPLY_TO_DOMAIN=reply.arivusystems.com
EMAIL_INBOUND_ADDRESS=inbox@reply.arivusystems.com
MAILBOX_OAUTH_SECRET=<openssl rand -hex 32>   # encrypts Gmail refresh tokens
```

---

## 4. DNS security (R0.4–R0.5)

### System sender (`mail.<domain>` / OCI)

- **SPF:** include OCI Email Delivery sending IPs for your region ([OCI docs](https://docs.oracle.com/en-us/iaas/Content/Email/Reference/dnsrecords.htm))
- **DKIM:** CNAME records from OCI Email Delivery console
- **DMARC:** `v=DMARC1; p=quarantine; rua=mailto:dmarc@<domain>`

### Google Workspace (shared + personal mailboxes)

- Configure SPF/DKIM/DMARC on the **tenant’s Google domain** (e.g. `acme.com`), not only `reply.<domain>`.

---

## 5. Secret rotation

| Secret | Impact | Steps |
|--------|--------|-------|
| `EMAIL_REPLY_TOKEN_SECRET` | Invalidates existing Reply-To tokens on in-flight mail | Rotate off-hours; old replies may fail routing until resent |
| `EMAIL_INBOUND_WEBHOOK_SECRET` | Breaks relay until updated | Update relay + API env together |
| `MAILBOX_OAUTH_SECRET` | Cannot decrypt stored Gmail tokens | Re-connect mailboxes after rotation |

---

## 6. Tenant policy flags (R0.8)

In `CommunicationConfig.outboundEmail` (API / future UI):

| Flag | Default | Purpose |
|------|---------|---------|
| `disallowPlatformSmtpForWorkspace` | `false` | Block inbox compose via platform SMTP (enable before R2 go-live) |
| `requireMailboxProviderForAgentSend` | `false` | Enforced when R2 provider send ships |

---

## 7. Verification checklist

- [ ] `GET /api/webhooks/email/inbound/health` returns configured secrets (prod)
- [ ] Send CRM email → Reply-To contains `replies+` or `reply+` token @ `reply.<domain>`
- [ ] Reply to that address → thread appears in CRM within 60s (queue running)
- [ ] Notification email sends with `SYSTEM_EMAIL_FROM` / OCI (not tenant Resend unless `SYSTEM_EMAIL_ALLOW_TENANT_PROVIDER=true`)
- [ ] SPF/DKIM/DMARC pass on system domain (mail-tester.com or similar)

---

## 8. Related docs

- [CRM_EMAIL_BLUEPRINT_ROADMAP.md](./CRM_EMAIL_BLUEPRINT_ROADMAP.md) — full R1–R7 plan
- [PHASE2_INBOUND_SETUP.md](../../docs/PHASE2_INBOUND_SETUP.md) — webhook curl examples
- [COMMUNICATION_PLATFORM_PHASE_PLAN.md](./COMMUNICATION_PLATFORM_PHASE_PLAN.md) — shipped platform phases
