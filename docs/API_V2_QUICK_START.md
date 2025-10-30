## API v2 Quick Start

### Auth

1) Log in to get a JWT (use your existing auth endpoint):

```bash
curl -s -X POST http://localhost:5000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@litedesk.com","password":"Admin@123"}' | jq -r .token
```

Export it:

```bash
export TOKEN=REPLACE_WITH_JWT
```

### People

Create a People record via the new People endpoint:

```bash
curl -s -X GET 'http://localhost:5000/api/people?page=1&limit=10' \
  -H "Authorization: Bearer $TOKEN" | jq
```

### Organization v2

Get current organization (v1 route with v2 overlay):

```bash
curl -s -X GET http://localhost:5000/api/organization \
  -H "Authorization: Bearer $TOKEN" | jq
```

Update organization (writes to OrganizationV2 when enabled):

```bash
curl -s -X PUT http://localhost:5000/api/organization \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{
    "name":"Acme Inc.",
    "industry":"Technology",
    "website":"https://acme.example",
    "phone":"+1-555-0100",
    "address":"1 Infinite Loop"
  }' | jq
```

### Feature Flags (defaults set in server)

- FEATURE_READ_THROUGH_PEOPLE=true
- FEATURE_CONTACTS_USE_PEOPLE=true
- FEATURE_READ_THROUGH_ORG=true
- FEATURE_ORG_USE_V2=true
- FEATURE_DUAL_WRITE_PEOPLE=false
- FEATURE_DUAL_WRITE_ORG=false

Override any at runtime via environment variables.


