# n8n Workflow Migration Guide

## Overview
This guide explains how to update your n8n workflows to work with the unified status field and WebSocket event architecture.

---

## Status Field Migration

### Old Schema (Deprecated)
```javascript
{
  isEnriched: false,  // ❌ DEPRECATED
  isPosted: false     // ❌ DEPRECATED
}
```

### New Schema (Current)
```javascript
{
  status: "pending" | "processing" | "enriched" | "posted" | "failed"
}
```

**Status Values:**
- `pending`: Newly created, waiting for enrichment
- `processing`: Enrichment workflow started (set by frontend optimistically)
- `enriched`: AI generation completed successfully
- `posted`: Manually published to marketplace/social media
- `failed`: Enrichment workflow failed

---

## Workflow Update Checklist

### 1. Update Product Fetch Node

**Old (Using deprecated fields):**
```javascript
// Filter condition in HTTP Request node
?isEnriched=false&isPosted=false
```

**New (Using unified status):**
```javascript
// Filter products with status "pending" or "processing"
?status=pending

// Or fetch by specific businessId and productId from webhook payload
GET /products/:businessId/:productId
```

---

### 2. Update Product Update Node

**Old (Setting deprecated flags):**
```http
PATCH /products/update/:businessId/:productId
Content-Type: application/json
Authorization: Bearer {{$json.accessToken}}

{
  "isEnriched": true,
  "generatedImageUrl": "{{$json.imageUrl}}",
  "advertisementText": "{{$json.caption}}",
  "imagePrompt": "{{$json.prompt}}"
}
```

**New (Using unified status):**
```http
PATCH /products/update/:businessId/:productId
Content-Type: application/json
Authorization: Bearer {{$json.accessToken}}

{
  "status": "enriched",
  "generatedImageUrl": "{{$json.imageUrl}}",
  "advertisementText": "{{$json.caption}}",
  "imagePrompt": "{{$json.prompt}}"
}
```

**Important:**
- Backend automatically emits `product:updated` socket event
- Frontend receives event and updates UI instantly
- No need for frontend to poll or refetch

---

### 3. Add Error Handling

**Error Handler Node (Function):**
```javascript
// If any node fails, update product status to "failed"
const errorMessage = $('Error Handler').first().json.error?.message || 'Workflow failed';

return {
  method: 'PATCH',
  url: `${$env.BACKEND_URL}/products/update/${$json.businessId}/${$json.productId}`,
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${$json.accessToken}`
  },
  body: {
    status: 'failed',
    errorMessage: errorMessage,
    failedAt: new Date().toISOString()
  }
};
```

**Benefits:**
- Frontend receives `product:updated` event with `status: "failed"`
- Processing spinner hides automatically
- User can retry "Generate"

---

## Example Workflow Structure

### Recommended Architecture

```
Webhook Trigger (POST /webhook/enrich-product)
    ↓
[Validate Input]
    ↓
[Set status = "processing"] ← OPTIONAL (frontend already does this optimistically)
    ↓
[OpenAI: Generate Caption]
    ↓ (on error → Error Handler)
[OpenAI: Generate Image Prompt]
    ↓ (on error → Error Handler)
[OpenAI: Generate Image (DALL-E)]
    ↓ (on error → Error Handler)
[Upload Image to Firebase Storage]
    ↓ (on error → Error Handler)
[PATCH /products/update] → status: "enriched"
    ↓
[Success Response]

Error Handler → [PATCH /products/update] → status: "failed"
```

---

## Example Workflow JSON (Simplified)

### 1. Webhook Trigger Node
```json
{
  "name": "Webhook - Enrich Product",
  "type": "n8n-nodes-base.webhook",
  "parameters": {
    "path": "enrich-product",
    "httpMethod": "POST",
    "authentication": "none",
    "responseMode": "onReceived"
  }
}
```

### 2. OpenAI Caption Generation Node
```json
{
  "name": "OpenAI - Generate Caption",
  "type": "n8n-nodes-base.openAi",
  "parameters": {
    "resource": "text",
    "operation": "complete",
    "model": "gpt-4",
    "prompt": "Create an engaging advertisement caption for: {{$json.product.name}}. Price: {{$json.product.price}}. Description: {{$json.product.description}}",
    "temperature": 0.7,
    "maxTokens": 100
  }
}
```

### 3. Backend Update Node (Success)
```json
{
  "name": "Backend - Update Product (Success)",
  "type": "n8n-nodes-base.httpRequest",
  "parameters": {
    "method": "PATCH",
    "url": "={{$env.BACKEND_URL}}/products/update/{{$json.businessId}}/{{$json.product.id}}",
    "authentication": "genericCredentialType",
    "genericAuthType": "httpHeaderAuth",
    "headerParameters": {
      "parameter": [
        {
          "name": "Authorization",
          "value": "=Bearer {{$json.accessToken}}"
        }
      ]
    },
    "bodyParametersJson": "={\n  \"status\": \"enriched\",\n  \"advertisementText\": \"{{$node['OpenAI - Generate Caption'].json.choices[0].text}}\",\n  \"imagePrompt\": \"{{$node['OpenAI - Generate Prompt'].json.choices[0].text}}\",\n  \"generatedImageUrl\": \"{{$node['Upload to Firebase'].json.url}}\"\n}"
  }
}
```

### 4. Backend Update Node (Error)
```json
{
  "name": "Backend - Update Product (Failed)",
  "type": "n8n-nodes-base.httpRequest",
  "parameters": {
    "method": "PATCH",
    "url": "={{$env.BACKEND_URL}}/products/update/{{$json.businessId}}/{{$json.product.id}}",
    "authentication": "genericCredentialType",
    "genericAuthType": "httpHeaderAuth",
    "headerParameters": {
      "parameter": [
        {
          "name": "Authorization",
          "value": "=Bearer {{$json.accessToken}}"
        }
      ]
    },
    "bodyParametersJson": "={\n  \"status\": \"failed\",\n  \"errorMessage\": \"{{$node['Error Handler'].first().json.error.message}}\"\n}"
  }
}
```

---

## Testing Your Updated Workflow

### 1. Manual Test via Webhook
```bash
curl -X POST https://your-n8n-instance.com/webhook/enrich-product \
  -H "Content-Type: application/json" \
  -d '{
    "accessToken": "your_firebase_token",
    "businessId": "test_business_id",
    "product": {
      "id": "test_product_id",
      "name": "Test Product",
      "price": 99.99,
      "description": "A test product for workflow validation"
    }
  }'
```

### 2. Verify Backend Logs
```bash
# Backend should log:
📡 Emitted product:updated for test_product_id
[Product] test_product_id → status set to enriched
```

### 3. Verify Frontend Console
```javascript
// Frontend console should show:
📦 product:updated test_product_id status: enriched
```

### 4. Verify UI
- Product card should show "ENRICHED" badge (green)
- Processing spinner should disappear
- Generated image should be visible

---

## Common Issues & Solutions

### Issue: Workflow Completes but UI Doesn't Update

**Cause**: Backend not emitting socket events

**Solution:**
1. Verify backend route emits event after Firestore write
2. Check backend logs for `📡 Emitted product:updated`
3. Verify user is authenticated and in correct room

---

### Issue: Status Shows "processing" Forever

**Cause**: Workflow failed silently without updating status

**Solution:**
1. Add error handler node to workflow
2. Update product status to "failed" in error handler
3. Check n8n execution logs for errors

---

### Issue: Multiple Socket Events for Same Product

**Cause**: Multiple workflow executions triggered simultaneously

**Solution:**
1. Add debouncing in frontend (prevent double-click on "Generate")
2. Check workflow for duplicate triggers
3. Verify n8n webhook response mode is "onReceived" (not "lastNode")

---

## Environment Variables (n8n)

Add these to your n8n instance:

```env
BACKEND_URL=https://your-backend-url.com
OPENAI_API_KEY=sk-...
FIREBASE_STORAGE_BUCKET=your-project.appspot.com
```

---

## Migration Timeline

### Phase 1: Backward Compatible (Current)
- ✅ Backend supports both old (`isEnriched`, `isPosted`) and new (`status`) fields
- ✅ Frontend only uses `status`
- ✅ Old workflows continue to work (but should be updated)

### Phase 2: Deprecation (Next Release)
- ⚠️ Backend logs warnings when old fields are used
- ⚠️ Update all workflows to use `status` field
- ⚠️ Old fields marked as deprecated in documentation

### Phase 3: Removal (Future Release)
- ❌ Backend removes support for old fields entirely
- ❌ Workflows using old fields will fail

**Action Required**: Update your workflows now to avoid disruption.

---

## Support

For issues or questions:
- Check n8n execution logs
- Review backend logs: `Auto-Advertisment-Backend/product-uploader/`
- Test webhook manually with curl
- Verify socket events in browser DevTools → Network → WS tab

