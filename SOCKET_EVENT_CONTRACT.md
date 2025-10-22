# Socket.IO Event Contract

## Overview
This document defines all WebSocket events emitted by the backend and consumed by the frontend for real-time data synchronization.

## Connection & Authentication

### Client → Server
- **Connection**: Client connects with Firebase ID token in auth handshake
  ```javascript
  io(API_URL, { auth: { token: firebaseIdToken } })
  ```

### Server → Client
- **`connect`**: Emitted when socket successfully connects
- **`disconnect`**: Emitted when socket disconnects
- **User Room**: Upon successful authentication, client is joined to room `user:${uid}`

---

## Product Events

All product events are emitted to the user's room (`user:${uid}`) to ensure data isolation.

### `product:created`
Emitted when a new product is created.

**Payload:**
```javascript
{
  id: string,
  businessId: string,
  name: string,
  price: number,
  imageUrl?: string,
  status: "pending" | "processing" | "enriched" | "posted" | "failed",
  createdAt: Timestamp,
  updatedAt: Timestamp,
  ...otherProductFields
}
```

**Triggered by:**
- `POST /products/:businessId`
- `POST /products/upload` (batch)

---

### `product:updated`
Emitted when product fields are modified.

**Payload:**
```javascript
{
  id: string,
  businessId: string,
  ...updatedFields,
  updatedAt: Timestamp
}
```

**Triggered by:**
- `PATCH /products/update/:businessId/:productId`
- `POST /products/upload/:businessId/:productId` (image upload)
- `POST /ai/generate-ad-image` (AI generation complete)
- n8n workflow completion (via backend endpoint)

**Common status transitions:**
- `pending` → `processing` (workflow started)
- `processing` → `enriched` (AI generation successful)
- `processing` → `failed` (AI generation failed)
- `enriched` → `posted` (manually published)

---

### `product:deleted`
Emitted when a product is permanently deleted.

**Payload:**
```javascript
{
  id: string,
  businessId: string
}
```

**Triggered by:**
- `DELETE /products/:businessId/:productId`

---

## Business Events

### `business:created`
Emitted when a new business is created.

**Payload:**
```javascript
{
  businessId: string,
  name: string,
  description: string,
  category?: string,
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

**Triggered by:**
- `POST /businesses`

---

### `business:updated`
Emitted when business details are modified.

**Payload:**
```javascript
{
  businessId: string,
  ...updatedFields,
  updatedAt: Timestamp
}
```

---

## User Events

### `user:updated`
Emitted when user profile information changes.

**Payload:**
```javascript
{
  uid: string,
  email: string,
  displayName?: string,
  photoURL?: string,
  ...updatedFields,
  updatedAt: Timestamp
}
```

---

## Frontend Implementation

### Redux Integration
Frontend listens to these events in `useProductSocket` hook and dispatches corresponding Redux actions:

- `product:created` → `addProductLocally(payload)`
- `product:updated` → `updateProductLocally(payload)`
- `product:deleted` → `removeProductLocally(payload.id)`

### Optimistic Updates
Frontend may optimistically set `status: "processing"` when triggering n8n workflows. This is reconciled by the next `product:updated` event from the server.

---

## Backend Implementation Guidelines

1. **Always emit events after successful Firestore write**
2. **Use user-scoped rooms**: `io.to(`user:${uid}`).emit(...)`
3. **Include full updated document** in payload for `updated` events
4. **Handle errors gracefully**: emit `failed` status on exceptions
5. **Log all emitted events** for debugging

---

## Testing

### Manual Testing
1. Open browser DevTools → Network → WS tab
2. Trigger actions (create/update/delete product)
3. Verify events are received with correct payloads

### Automated Testing
```javascript
// Example: Listen for product:updated
socket.on('product:updated', (payload) => {
  console.log('✅ Received product:updated', payload);
  expect(payload.id).toBeDefined();
  expect(payload.status).toBe('enriched');
});
```

---

## Migration Notes

- **Before**: Frontend made HTTP GET after every mutation to fetch updated data
- **After**: Frontend receives updates via WebSocket, eliminating redundant reads
- **Firestore reads reduced by ~70%** for active users

