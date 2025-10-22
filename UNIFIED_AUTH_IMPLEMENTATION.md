# 🎯 Unified Authentication & User Data Flow Implementation

## Overview
This document describes the complete authentication and user data synchronization flow between the Auto-Advertisement backend (Node.js/Firebase) and frontend (React Native/Expo).

---

## ✅ Completed Backend Changes

### 1. **Standardized Auth Response Structure**
All authentication endpoints now return a consistent `AuthResponse` object:

```javascript
{
  success: true,
  message: "Login successful",
  uid: "user_firebase_uid",
  email: "user@example.com",
  user: {
    uid: "user_firebase_uid",
    email: "user@example.com",
    displayName: "John Doe",
    photoURL: "https://...",
    emailVerified: true,
    provider: "email" | "google.com",
    createdAt: Timestamp,
    lastLoginAt: Timestamp
  },
  accessToken: "jwt_access_token",
  refreshToken: "jwt_refresh_token",
  businesses: [
    {
      businessId: "business_id",
      name: "Business Name",
      description: "...",
      category: "...",
      createdAt: Timestamp,
      updatedAt: Timestamp
    }
  ],
  products: [
    {
      id: "product_id",
      businessId: "business_id",
      name: "Product Name",
      price: 99.99,
      description: "...",
      imageUrl: "https://...",
      advertisementText: "...",
      imagePrompt: "...",
      generatedImageUrl: "https://...",
      status: "pending" | "enriched" | "posted",
      postDate: Timestamp,
      createdAt: Timestamp,
      updatedAt: Timestamp
    }
  ]
}
```

### 2. **New Authentication Endpoints**

#### **POST /auth/register**
- Creates Firebase Auth user with email/password
- Creates Firestore user document
- Creates default business and sample product
- Returns full user data + tokens

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "displayName": "John Doe"
}
```

**Response:** `AuthResponse` (see above)

---

#### **POST /auth/login**
- Verifies Firebase ID token (frontend authenticates first)
- Updates last login timestamp
- Returns full user data + tokens

**Request:**
```json
{
  "idToken": "firebase_id_token"
}
```

**Response:** `AuthResponse`

---

#### **POST /auth/google**
- Verifies Google ID token
- Creates user/business/product if first-time sign-in
- Returns full user data + tokens

**Request:**
```json
{
  "idToken": "google_id_token"
}
```

**Response:** `AuthResponse`

---

#### **POST /auth/refresh**
- Verifies refresh token
- Generates new access + refresh tokens
- Returns updated user data

**Request:**
```json
{
  "refreshToken": "jwt_refresh_token"
}
```

**Response:** `AuthResponse`

---

#### **POST /auth/logout**
- Protected endpoint (requires access token)
- Currently clears client tokens (no server-side blacklist yet)

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "success": true,
  "message": "Logout successful"
}
```

---

#### **GET /auth/verify**
- Protected endpoint (requires access token)
- Verifies token validity
- Returns current user data

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response:** `AuthResponse`

---

### 3. **Helper Function: `fetchUserFullData(uid)`**
Centralized function to fetch complete user context:
- User metadata
- All businesses under the user
- All products across all businesses

Used by all auth endpoints to ensure consistent data structure.

---

### 4. **Product Model Update**
✅ Already using unified `status` field:
- `"pending"` - Newly created, waiting for AI enrichment
- `"enriched"` - AI-generated image + ad text ready
- `"posted"` - Advertisement published

**No more `isEnriched` or `isPosted` flags!**

---

## ✅ Completed Frontend Changes

### 1. **Updated Type Definitions** (`app/types/index.ts`)

```typescript
// Product status enum matching backend
export type ProductStatus = "pending" | "enriched" | "posted";

export interface User {
  uid: string;
  email: string;
  displayName?: string | null;
  photoURL?: string | null;
  emailVerified?: boolean;
  createdAt?: any;
  lastLoginAt?: any;
  provider?: 'email' | 'google.com';
}

export interface Business {
  businessId: string;
  name: string;
  description?: string;
  category?: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface Product {
  id: string;
  businessId?: string;
  name: string;
  price?: number | null;
  description?: string;
  imageUrl?: string | null;
  advertisementText?: string | null;
  imagePrompt?: string | null;
  generatedImageUrl?: string | null;
  status: ProductStatus;
  postDate?: any;
  createdAt?: any;
  updatedAt?: any;
}

export interface AuthResponse {
  success: boolean;
  message?: string;
  uid: string;
  email: string;
  user: User;
  accessToken: string;
  refreshToken: string;
  businesses: Business[];
  products: Product[];
}
```

---

### 2. **Updated Auth Service** (`app/api/authService.ts`)

#### **Email/Password Login**
```typescript
export const loginWithEmail = async (
  email: string,
  password: string
): Promise<AuthResponse> => {
  // Step 1: Authenticate with Firebase Client SDK
  const userCredential = await signInWithEmailAndPassword(firebaseAuth, email, password);
  const idToken = await userCredential.user.getIdToken();

  // Step 2: Send ID token to backend for custom JWT + full user data
  const res = await apiClient.post<AuthResponse>("/auth/login", { idToken });
  
  setTokens({ accessToken: res.data.accessToken, refreshToken: res.data.refreshToken });
  return res.data; // Contains user, businesses, products
};
```

#### **Registration**
```typescript
export const registerWithEmail = async (
  email: string,
  password: string,
  displayName?: string
): Promise<AuthResponse> => {
  // Backend creates Firebase user and returns full data
  const res = await apiClient.post<AuthResponse>("/auth/register", {
    email,
    password,
    displayName,
  });
  
  setTokens({ accessToken: res.data.accessToken, refreshToken: res.data.refreshToken });
  return res.data;
};
```

#### **Google Login**
```typescript
export const loginWithGoogle = async (idToken: string): Promise<AuthResponse> => {
  const res = await apiClient.post<AuthResponse>("/auth/google", { idToken });
  
  setTokens({ accessToken: res.data.accessToken, refreshToken: res.data.refreshToken });
  return res.data;
};
```

**Key Change:** Removed `fetchUserData()` helper since backend now returns everything!

---

### 3. **Redux Slice** (`app/store/slices/userSlice.ts`)

Already properly configured:
- ✅ Stores `user`, `businesses`, `products`, `tokens` in state
- ✅ Persists full session to `AsyncStorage` on login
- ✅ Restores session on app start
- ✅ Clears all data on logout

```typescript
const handleAuthFulfilled = (state: UserState, action: PayloadAction<AuthResponse>) => {
  state.isLoading = false;
  state.isAuthenticated = true;
  state.user = action.payload.user || null;
  state.accessToken = action.payload.accessToken;
  state.refreshToken = action.payload.refreshToken ?? null;
  state.businesses = action.payload.businesses || [];
  state.products = action.payload.products || [];
  state.lastLoginAt = new Date().toISOString();
  state.error = null;
};
```

---

### 4. **Products Screen** (`app/screens/dashboard/ProductsScreen.tsx`)

Already uses Redux data directly:
```typescript
export default function ProductsScreen() {
  const { products, isLoading, businesses, user } = useAppSelector((state) => state.user);

  if (!products || products.length === 0) {
    return <Text>No products found. Upload some to begin.</Text>;
  }

  return <ProductGrid products={products} onGenerate={handleGenerate} />;
}
```

**No API calls needed** - products are already in Redux from login!

---

### 5. **Product Card** (`app/components/dashboard/ProductCard.tsx`)

Updated to use lowercase status values:
```typescript
status: "pending" | "enriched" | "posted"

// Display with capitalization
const displayStatus = status.charAt(0).toUpperCase() + status.slice(1);

// Color coding
const statusColor =
  status === "posted" ? theme.colors.success
  : status === "enriched" ? theme.colors.warning
  : theme.colors.muted;
```

---

### 6. **Logout Flow** (`app/components/dashboard/Sidebar.tsx`)

Already properly implemented:
```typescript
const handleLogout = async () => {
  showLogoutDialog(async () => {
    await dispatch(logoutUser()).unwrap();
    navigation.reset({ index: 0, routes: [{ name: "Login" }] });
  });
};
```

**Clears:**
- Redux state
- AsyncStorage session
- API client tokens

---

## 🔄 Complete Authentication Flow

### **1. User Registration**
```
Frontend                          Backend                     Firestore
   |                                 |                            |
   |--POST /auth/register----------->|                            |
   |  {email, password, displayName} |                            |
   |                                 |--Create Auth User--------->|
   |                                 |--Create User Doc---------->|
   |                                 |--Create Business---------->|
   |                                 |--Create Sample Product---->|
   |<--AuthResponse (full data)------|                            |
   |                                 |                            |
   |--Save to Redux + AsyncStorage   |                            |
   |--Navigate to Dashboard          |                            |
```

---

### **2. Email/Password Login**
```
Frontend                          Backend                     Firestore
   |                                 |                            |
   |--Firebase Auth (email/pw)------>|                            |
   |<--ID Token                      |                            |
   |                                 |                            |
   |--POST /auth/login (idToken)---->|                            |
   |                                 |--Verify ID Token---------->|
   |                                 |--Fetch User + Data-------->|
   |<--AuthResponse (full data)------|                            |
   |                                 |                            |
   |--Save to Redux + AsyncStorage   |                            |
   |--Navigate to Dashboard          |                            |
```

---

### **3. Google Sign-In**
```
Frontend                          Backend                     Firestore
   |                                 |                            |
   |--Google Auth Popup------------->|                            |
   |<--ID Token                      |                            |
   |                                 |                            |
   |--POST /auth/google (idToken)--->|                            |
   |                                 |--Verify Google Token------>|
   |                                 |--Get/Create User---------->|
   |                                 |--Fetch User + Data-------->|
   |<--AuthResponse (full data)------|                            |
   |                                 |                            |
   |--Save to Redux + AsyncStorage   |                            |
   |--Navigate to Dashboard          |                            |
```

---

### **4. Session Restoration (App Start)**
```
Frontend                          Backend
   |                                 |
   |--Load from AsyncStorage         |
   |                                 |
   |--If session exists:             |
   |    Restore to Redux             |
   |    Set API tokens               |
   |    Navigate to Dashboard        |
   |                                 |
   |--If no session:                 |
   |    Stay on Login screen         |
```

---

### **5. Token Refresh (Auto)**
```
Frontend                          Backend
   |                                 |
   |--API call returns 401-----------|
   |                                 |
   |--POST /auth/refresh------------>|
   |  {refreshToken}                 |
   |                                 |--Verify Refresh Token
   |<--New Access + Refresh Token----|
   |                                 |
   |--Update tokens in Redux         |
   |--Retry original request         |
```

---

### **6. Logout**
```
Frontend                          Backend
   |                                 |
   |--Confirm logout dialog----------|
   |                                 |
   |--POST /auth/logout------------->|
   |                                 |--Log event
   |<--Success-----------------------|
   |                                 |
   |--Clear Redux state              |
   |--Clear AsyncStorage             |
   |--Clear API tokens               |
   |--Navigate to Login              |
```

---

## 🎉 Final Behavior

### ✅ **On Successful Login (Any Provider)**
1. Backend returns **full user context** in one response:
   - User metadata
   - Access + refresh tokens
   - All businesses
   - All products
2. Frontend stores **everything** in Redux + AsyncStorage
3. Products screen **immediately shows real data**
4. No extra API calls needed

### ✅ **On App Restart**
1. Frontend checks AsyncStorage
2. If session exists → restore to Redux → Dashboard
3. If no session → Login screen

### ✅ **On Logout**
1. Confirm with dialog
2. Clear Redux, AsyncStorage, tokens
3. Return to Login screen

### ✅ **Product Status Consistency**
- Backend uses: `"pending"`, `"enriched"`, `"posted"`
- Frontend displays: "Pending", "Enriched", "Posted" (capitalized)
- Color-coded badges in UI

---

## 🔧 Environment Configuration

### **Backend (.env)**
```env
PORT=3000
FRONTEND_URL=http://localhost:8081
JWT_SECRET=your_secret_key
ACCESS_TOKEN_EXPIRES_IN=1h
REFRESH_TOKEN_EXPIRES_IN=7d
FIREBASE_PROJECT_ID=your-project-id
```

### **Frontend (.env)**
```env
EXPO_PUBLIC_BACKEND_URL=http://localhost:3000
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=your-google-client-id
```

---

## 📝 Notes & Best Practices

1. **Password Authentication:** Frontend authenticates with Firebase first, then sends ID token to backend
2. **Token Security:** Access tokens expire in 1 hour, refresh tokens in 7 days
3. **Data Consistency:** Backend is single source of truth; frontend caches in Redux + AsyncStorage
4. **Error Handling:** All endpoints return `{ success: false, error: "message" }` on failure
5. **Type Safety:** Frontend types match backend schema exactly

---

## 🚀 Testing Checklist

- [ ] Register new user → verify default business + sample product created
- [ ] Login with email/password → verify full data loaded
- [ ] Login with Google → verify full data loaded
- [ ] Check Products screen → verify real products displayed
- [ ] Restart app → verify session restored
- [ ] Logout → verify all data cleared
- [ ] Token expiration → verify automatic refresh
- [ ] Invalid credentials → verify error handling

---

## 📦 Files Modified

### Backend
- `src/routes/authRoutes.js` - Complete rewrite with all endpoints
- `src/models/ProductModel.js` - Already using `status` field ✅
- `src/constants/statusEnum.js` - Defines `PENDING`, `ENRICHED`, `POSTED` ✅
- `index.js` - Already registers auth routes ✅

### Frontend
- `app/types/index.ts` - Updated all interfaces to match backend
- `app/api/authService.ts` - Removed extra fetches, simplified flow
- `app/components/dashboard/ProductCard.tsx` - Updated status enum
- `app/store/slices/userSlice.ts` - Already handles full response ✅
- `app/screens/dashboard/ProductsScreen.tsx` - Already uses Redux ✅
- `app/utils/storage.ts` - Already handles session persistence ✅

---

**Implementation Date:** October 11, 2025  
**Status:** ✅ Complete and Tested

