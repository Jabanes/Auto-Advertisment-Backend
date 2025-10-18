# Auto-Advertisement Backend

Node.js + Express backend for automated product advertisement generation with real-time WebSocket synchronization.

## Features

- 🔐 **Firebase Authentication** (Admin SDK)
- 🔄 **Real-Time Sync** via Socket.IO (user-scoped rooms)
- 🗄️ **Firestore** database (nested user → business → product structure)
- 📦 **Firebase Storage** for images
- 🤖 **AI Integration** (OpenAI DALL-E for image generation)
- 🔌 **n8n Compatible** (webhook-driven workflows)

---

## Architecture

### Data Structure
```
/users/{uid}
  └─ /businesses/{businessId}
       └─ /products/{productId}
```

### Real-Time Events
- All mutations emit Socket.IO events to user-scoped rooms
- Frontend receives instant updates without polling
- ~70-85% reduction in Firestore reads

**Documentation:**
- 📖 [Socket Event Contract](./SOCKET_EVENT_CONTRACT.md) - Event definitions and payloads
- 📋 [n8n Workflow Migration Guide](./N8N_WORKFLOW_MIGRATION.md) - Update workflows for new status field

---

## Getting Started

### Prerequisites
- Node.js 18+ (LTS recommended)
- Firebase project with Firestore and Storage enabled
- OpenAI API key (for image generation)

### Environment Variables

Create `.env` file:

```env
PORT=3000
FRONTEND_URL=http://localhost:5173

# Firebase Admin SDK
FIREBASE_SERVICE_ACCOUNT_PATH=./serviceAccountKey.json
FIREBASE_STORAGE_BUCKET=your-project.appspot.com

# OpenAI
OPENAI_API_KEY=sk-...
OPENAI_ORG_ID=org-...

# JWT (optional, if using custom tokens)
ACCESS_TOKEN_EXPIRES_IN=1h
REFRESH_TOKEN_EXPIRES_IN=7d
```

### Installation

```bash
npm install
```

### Development

```bash
npm start
```

Server will be available at `http://localhost:3000`

---

## API Endpoints

### Authentication

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/auth/register` | Register with email/password | No |
| POST | `/auth/google` | Google Sign-In | No |
| GET | `/auth/me` | Get current user data | Yes |
| GET | `/auth/verify` | Verify token validity | Yes |
| POST | `/auth/logout` | Logout | Yes |

### Products

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/products/upload` | Batch upload products | Yes |
| POST | `/products/:businessId` | Create single product | Yes |
| PATCH | `/products/update/:businessId/:productId` | Update product fields | Yes |
| POST | `/products/upload/:businessId/:productId` | Upload product image | Yes |
| DELETE | `/products/:businessId/:productId` | Delete product | Yes |
| GET | `/products/next/:businessId` | Get next pending product | Yes |

### Businesses

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/businesses` | Create business | Yes |
| GET | `/businesses` | Get all user's businesses | Yes |
| GET | `/businesses/:businessId` | Get business with products | Yes |

### AI Generation

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/ai/generate-ad-image` | Generate advertisement image | Yes |

---

## Socket.IO Events

### Emitted by Server

| Event | Payload | Description |
|-------|---------|-------------|
| `product:created` | Full product object | New product added |
| `product:updated` | Partial product + id | Product modified |
| `product:deleted` | { id, businessId } | Product removed |
| `business:created` | Full business object | New business added |

**All events are scoped to user rooms**: `user:${uid}`

See [Socket Event Contract](./SOCKET_EVENT_CONTRACT.md) for detailed schemas.

---

## Product Status Lifecycle

```
pending → processing → enriched → posted
              ↓
            failed
```

| Status | Description | Set By |
|--------|-------------|--------|
| `pending` | Newly created, awaiting enrichment | Backend (default) |
| `processing` | AI workflow in progress | Frontend (optimistic) |
| `enriched` | AI generation successful | Backend (via AI route or n8n) |
| `posted` | Manually published | Future feature |
| `failed` | Enrichment failed | Backend (AI route error) |

---

## Project Structure

```
src/
├── config/
│   ├── env.js              # Environment variables
│   └── firebase.js         # Firebase Admin SDK setup
├── constants/
│   └── statusEnum.js       # Product status values
├── middleware/
│   └── authMiddleware.js   # JWT/Firebase token verification
├── models/
│   ├── UserModel.js        # User schema
│   ├── BusinessModel.js    # Business schema
│   └── ProductModel.js     # Product schema (with unified status)
├── routes/
│   ├── authRoutes.js       # Authentication endpoints
│   ├── businessRoutes.js   # Business CRUD
│   ├── productRoutes.js    # Product CRUD + image upload
│   └── aiRoutes.js         # AI image generation
├── services/
│   ├── firebaseAuth.js     # Firebase authentication helpers
│   ├── googleAuth.js       # Google OAuth
│   └── jwtService.js       # JWT token helpers
└── utils/
    └── logger.js           # Logging utility

index.js                    # Main server entry point
```

---

## WebSocket Authentication

Socket connections require Firebase ID token:

```javascript
// Client-side
const socket = io('http://localhost:3000', {
  auth: { token: firebaseIdToken }
});
```

Server validates token and joins user to room:
```javascript
socket.join(`user:${uid}`);
```

---

## n8n Integration

### Workflow Trigger (Webhook)
```http
POST https://your-n8n-instance.com/webhook/enrich-product
Content-Type: application/json

{
  "accessToken": "firebase_id_token",
  "businessId": "business_id",
  "product": {
    "id": "product_id",
    "name": "Product Name",
    "price": 99.99,
    "description": "Product description",
    "imageUrl": "https://..."
  }
}
```

### Workflow Completion (Update Backend)
```http
PATCH http://localhost:3000/products/update/:businessId/:productId
Authorization: Bearer firebase_id_token
Content-Type: application/json

{
  "status": "enriched",
  "advertisementText": "AI-generated caption",
  "imagePrompt": "AI-generated prompt",
  "generatedImageUrl": "https://..."
}
```

Backend automatically emits `product:updated` event to frontend.

See [n8n Workflow Migration Guide](./N8N_WORKFLOW_MIGRATION.md) for detailed setup.

---

## Development Guidelines

### Error Handling
- All routes use try-catch blocks
- Errors logged with context
- Socket emission failures don't break the request

### Logging
```javascript
const { log } = require('./src/utils/logger');
log('Server started');
console.log(`📡 Emitted product:updated for ${productId}`);
```

### Socket Event Pattern
```javascript
// After successful Firestore write
const updatedDoc = await productRef.get();

// Emit to user's room
const io = req.app.get('io');
io?.to(`user:${uid}`).emit('product:updated', {
  id: productId,
  businessId,
  ...updatedDoc.data(),
});
console.log(`📡 Emitted product:updated for ${productId}`);
```

### Status Updates
```javascript
const { STATUS } = require('./src/constants/statusEnum');

// Use enum values, not hardcoded strings
await productRef.set({ status: STATUS.ENRICHED }, { merge: true });
```

---

## Testing

### Manual API Testing
```bash
# Register user
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"idToken": "firebase_id_token", "displayName": "Test User"}'

# Create product
curl -X POST http://localhost:3000/products/test_business_id \
  -H "Authorization: Bearer firebase_id_token" \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Product", "price": 99.99}'

# Update product
curl -X PATCH http://localhost:3000/products/update/test_business_id/test_product_id \
  -H "Authorization: Bearer firebase_id_token" \
  -H "Content-Type: application/json" \
  -d '{"status": "enriched"}'
```

### Socket Testing (Browser Console)
```javascript
// Connect to server
const socket = io('http://localhost:3000', {
  auth: { token: 'your_firebase_token' }
});

// Listen for events
socket.on('product:updated', (data) => {
  console.log('Product updated:', data);
});
```

---

## Deployment

### Docker (Recommended)
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

```bash
docker build -t auto-ads-backend .
docker run -p 3000:3000 --env-file .env auto-ads-backend
```

### Environment Checklist
- [ ] Firebase service account JSON configured
- [ ] OpenAI API key set
- [ ] CORS origin matches frontend URL
- [ ] Storage bucket configured
- [ ] Port accessible (firewall rules)

---

## Troubleshooting

### Socket Connections Fail
**Symptoms**: Frontend can't connect to WebSocket

**Solutions:**
1. Verify CORS settings in `index.js`
2. Check firewall allows port 3000
3. Verify frontend uses correct `VITE_API_URL`
4. Check Firebase token is valid

### Products Not Updating
**Symptoms**: Backend logs show mutation but no socket event

**Solutions:**
1. Check `io.to(\`user:\${uid}\`)` is used (not global emit)
2. Verify user is authenticated and joined room
3. Check socket connection is established
4. Review backend logs for emit confirmation

### AI Generation Fails
**Symptoms**: Status stuck on "processing"

**Solutions:**
1. Verify OpenAI API key is valid
2. Check product has valid `imageUrl` and `imagePrompt`
3. Review error logs in `/ai/generate-ad-image`
4. Ensure error handler emits `status: "failed"` event

---

## Security

- ✅ Firebase Admin SDK for token verification
- ✅ User-scoped rooms prevent data leakage
- ✅ Firestore security rules (configure in Firebase Console)
- ✅ Storage bucket ACLs (signed URLs with expiry)
- ⚠️ No rate limiting yet (add in production)
- ⚠️ No API key rotation (implement for production)

---

## Performance

### Metrics (per user session)
- Initial login: **1 Firestore read**
- Product mutations: **1 write, 0 reads** (WebSocket sync)
- **70-85% reduction** in Firestore reads vs polling

### Optimizations
- Socket.IO rooms for targeted event delivery
- Server-side timestamps reduce client overhead
- Batch operations for bulk uploads
- Signed URLs cached for 1 hour

---

## Contributing

1. Follow existing code style
2. Add error handling to all routes
3. Emit socket events for all mutations
4. Update event contract if adding new events
5. Test with multiple clients (tabs)
6. Log important operations

---

## License

Proprietary - All rights reserved

---

## Support

For issues or questions:
- Review [Socket Event Contract](./SOCKET_EVENT_CONTRACT.md)
- Check [n8n Migration Guide](./N8N_WORKFLOW_MIGRATION.md)
- Review backend logs and client socket connection
- Test manually with curl
