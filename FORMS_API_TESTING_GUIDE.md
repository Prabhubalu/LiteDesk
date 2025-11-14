# Forms Module API Testing Guide

This guide provides instructions for testing the Forms Module API endpoints.

## Prerequisites

1. **Server Running**: Ensure the backend server is running
   ```bash
   cd server
   npm start
   ```

2. **Authentication**: You need a valid user account and authentication token

3. **Forms Module Enabled**: Ensure the 'forms' module is enabled in your organization

## Quick Test Script

Run the automated test script:

```bash
node server/scripts/testFormsAPI.js
```

The script will test all endpoints automatically. Make sure to set these environment variables or update the script:

```bash
export TEST_EMAIL=your-email@example.com
export TEST_PASSWORD=your-password
export API_BASE_URL=http://localhost:5000
```

## Manual Testing with cURL

### 1. Authentication

```bash
# Login to get token
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "your-email@example.com",
    "password": "your-password"
  }'

# Save the token from response
export TOKEN="your-jwt-token-here"
```

### 2. Create Form

```bash
curl -X POST http://localhost:5000/api/forms \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Audit Form",
    "description": "A test audit form",
    "formType": "Audit",
    "linkedModule": "Organization",
    "visibility": "Internal",
    "status": "Draft",
    "sections": [
      {
        "sectionId": "SEC-001",
        "name": "Store Readiness",
        "weightage": 40,
        "order": 1,
        "subsections": [
          {
            "subsectionId": "SUB-001",
            "name": "Exterior",
            "weightage": 20,
            "order": 1,
            "questions": [
              {
                "questionId": "Q-001",
                "questionText": "Is signage visible?",
                "type": "Yes-No",
                "mandatory": true,
                "scoringLogic": {
                  "passValue": "Yes",
                  "failValue": "No",
                  "weightage": 10
                },
                "passFailDefinition": "Yes = Pass",
                "order": 1
              }
            ]
          }
        ]
      }
    ],
    "kpiMetrics": {
      "compliancePercentage": true
    },
    "thresholds": {
      "pass": 80,
      "partial": 50
    }
  }'
```

### 3. Get All Forms

```bash
curl -X GET http://localhost:5000/api/forms \
  -H "Authorization: Bearer $TOKEN"
```

### 4. Get Form By ID

```bash
# Replace FORM_ID with actual form ID
curl -X GET http://localhost:5000/api/forms/FORM_ID \
  -H "Authorization: Bearer $TOKEN"
```

### 5. Update Form

```bash
# Only Draft forms can be updated
curl -X PUT http://localhost:5000/api/forms/FORM_ID \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated Form Name",
    "description": "Updated description"
  }'
```

### 6. Enable Public Form

```bash
curl -X PUT http://localhost:5000/api/forms/FORM_ID \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "Active",
    "publicLink": {
      "enabled": true,
      "slug": "my-public-form"
    }
  }'
```

### 7. Get Public Form (No Auth)

```bash
curl -X GET http://localhost:5000/api/public/forms/my-public-form
```

### 8. Submit Form Response

```bash
# Authenticated submission
curl -X POST http://localhost:5000/api/forms/FORM_ID/submit \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "responseDetails": [
      {
        "questionId": "Q-001",
        "sectionId": "SEC-001",
        "subsectionId": "SUB-001",
        "answer": "Yes"
      }
    ],
    "linkedTo": {
      "type": "Organization",
      "id": "ORGANIZATION_ID"
    }
  }'

# Public submission (no auth required)
curl -X POST http://localhost:5000/api/public/forms/my-public-form/submit \
  -H "Content-Type: application/json" \
  -d '{
    "responseDetails": [
      {
        "questionId": "Q-001",
        "sectionId": "SEC-001",
        "subsectionId": "SUB-001",
        "answer": "Yes"
      }
    ]
  }'
```

### 9. Get Form Responses

```bash
curl -X GET http://localhost:5000/api/forms/FORM_ID/responses \
  -H "Authorization: Bearer $TOKEN"
```

### 10. Get Response By ID

```bash
curl -X GET http://localhost:5000/api/forms/FORM_ID/responses/RESPONSE_ID \
  -H "Authorization: Bearer $TOKEN"
```

### 11. Add Corrective Action

```bash
curl -X POST http://localhost:5000/api/forms/FORM_ID/responses/RESPONSE_ID/corrective-action \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "questionId": "Q-001",
    "comment": "Corrective action taken",
    "proof": [],
    "status": "In Progress"
  }'
```

### 12. Verify Corrective Action

```bash
curl -X POST http://localhost:5000/api/forms/FORM_ID/responses/RESPONSE_ID/verify \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "questionId": "Q-001",
    "approved": true,
    "comment": "Verified and approved"
  }'
```

### 13. Get Form Analytics

```bash
curl -X GET http://localhost:5000/api/forms/FORM_ID/analytics \
  -H "Authorization: Bearer $TOKEN"
```

### 14. Get Form KPIs

```bash
curl -X GET http://localhost:5000/api/forms/FORM_ID/kpis \
  -H "Authorization: Bearer $TOKEN"
```

### 15. Duplicate Form

```bash
curl -X POST http://localhost:5000/api/forms/FORM_ID/duplicate \
  -H "Authorization: Bearer $TOKEN"
```

### 16. Export Responses

```bash
curl -X GET http://localhost:5000/api/forms/FORM_ID/responses/export \
  -H "Authorization: Bearer $TOKEN" \
  -o responses.csv
```

### 17. Get Response Comparison

```bash
curl -X GET "http://localhost:5000/api/forms/FORM_ID/responses/RESPONSE_ID/compare?previousResponseId=PREVIOUS_RESPONSE_ID" \
  -H "Authorization: Bearer $TOKEN"
```

## Testing Checklist

### Form Management
- [ ] Create form with sections and questions
- [ ] Get all forms (with pagination and filters)
- [ ] Get form by ID
- [ ] Update form (Draft only)
- [ ] Duplicate form
- [ ] Delete form
- [ ] Enable public form
- [ ] Get public form (no auth)

### Form Submission
- [ ] Submit form response (authenticated)
- [ ] Submit form response (public)
- [ ] Validate mandatory questions
- [ ] Test scoring calculation
- [ ] Test section scores
- [ ] Test form-level KPIs

### Response Management
- [ ] Get all responses for a form
- [ ] Get response by ID
- [ ] Update response status
- [ ] Add corrective action
- [ ] Verify corrective action
- [ ] Approve response
- [ ] Reject response
- [ ] Export responses to CSV
- [ ] Get response comparison

### Analytics & KPIs
- [ ] Get form analytics
- [ ] Get form KPIs
- [ ] Verify KPI calculations
- [ ] Test compliance percentage
- [ ] Test pass/fail thresholds

## Common Issues & Solutions

### Issue: "Form not found or access denied"
**Solution**: Ensure you're using the correct organization ID and the form belongs to your organization.

### Issue: "Only Draft forms can be edited"
**Solution**: Forms must be in 'Draft' status to be updated. Create a new version or duplicate the form.

### Issue: "Mandatory question not answered"
**Solution**: Ensure all mandatory questions are included in the response details.

### Issue: "Invalid question ID"
**Solution**: Verify that all question IDs in the response match the form structure.

### Issue: "Authentication failed"
**Solution**: Check that your token is valid and not expired. Re-authenticate if needed.

## Expected Response Formats

### Success Response
```json
{
  "success": true,
  "data": { ... },
  "message": "Operation successful"
}
```

### Error Response
```json
{
  "success": false,
  "message": "Error message",
  "error": "Detailed error information"
}
```

## Next Steps

After testing the API endpoints:

1. **Frontend Integration**: Test with the frontend application
2. **Performance Testing**: Test with large forms and many responses
3. **Security Testing**: Test permission checks and organization isolation
4. **Edge Cases**: Test with invalid data, missing fields, etc.

## Support

If you encounter issues:
1. Check server logs for detailed error messages
2. Verify database connection
3. Ensure all required middleware is configured
4. Check that the 'forms' module is enabled in your organization

