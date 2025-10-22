# 🚨 URGENT FIXES - Login & Business Switcher

## Issue 1: CORS Error - Login Failing ❌

### Problem
```
POST http://localhost:3000/auth/google net::ERR_FAILED
Access-Control-Allow-Origin header is not present
```

### Root Cause
Your backend `.env` file has:
```
FRONTEND_URLS=http://localhost:8081
```

But your frontend is running on:
```
http://localhost:5174
```

### Solution

**Option A: Update .env file (Recommended)**

Create or update `Auto-Advertisment-Backend/.env`:

```env
# Update this line
FRONTEND_URLS=http://localhost:5174

# If you need multiple URLs (dev + prod), use commas
# FRONTEND_URLS=http://localhost:5174,http://localhost:8081,https://yourapp.com
```

**Option B: Quick Test (Temporary)**

In `Auto-Advertisment-Backend/src/config/env.js`, change line 5:
```javascript
// FROM:
FRONTEND_URLS = "http://localhost:8081",

// TO:
FRONTEND_URLS = "http://localhost:5174",
```

### Backend Changes Already Made
✅ Added proper CORS configuration with OPTIONS support
✅ Added explicit methods and headers
✅ Added preflight request handler

```javascript
app.use(
  cors({
    origin: FRONTEND_URLS,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.options('*', cors()); // Handle preflight
```

---

## Issue 2: BusinessSwitcher Covered by Content ❌

### Problem
The BusinessSwitcher dropdown was being hidden behind dashboard content.

### Solution ✅
**Already Fixed!**

1. **Sidebar z-index increased:**
```typescript
zIndex: 1000  // Sidebar above content
```

2. **Dropdown z-index maximized:**
```typescript
zIndex: 10000  // Dropdown above everything
position: "fixed"  // Absolute positioning
bottom: 120  // More space above button
boxShadow: "enhanced"  // Better visual separation
```

The dropdown now properly floats above all content!

---

## Issue 3: Business Data Not Rehydrating ❌

### Problem
When switching businesses, the business details weren't being refreshed - only products.

### Solution ✅
**Already Fixed!**

Updated `listenerMiddleware.ts` to fetch BOTH business details AND products:

```typescript
// 🔄 Business Switch: Refetch business details AND products
startAppListening({
  actionCreator: setCurrentBusinessId,
  effect: async (action, { dispatch, getState }) => {
    const businessId = action.payload;
    const token = state.auth.serverToken;

    if (token) {
      // 1. Fetch fresh business details
      await dispatch(fetchBusiness({ token, businessId }));
      
      // 2. Fetch products for the new business
      await dispatch(fetchProducts(token));
    }
  },
});
```

**Flow:**
```
User clicks business → setCurrentBusinessId →
Listener intercepts →
1. Fetch business details (name, logo, etc.) →
2. Fetch products for that business →
Redux updates → UI refreshes
```

---

## 🚀 Quick Start Steps

### 1. Fix CORS (Required)

**Create `.env` file in backend root:**
```bash
cd Auto-Advertisment-Backend
```

Create `.env` with:
```env
PORT=3000
FRONTEND_URLS=http://localhost:5174
FIREBASE_API_KEY=your_firebase_key
GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json
FIREBASE_STORAGE_BUCKET=your_bucket
OPENAI_API_KEY=your_openai_key
GOOGLE_WEB_CLIENT_ID=your_client_id
```

### 2. Restart Backend
```bash
npm start
```

You should see:
```
🚀 Server running on http://localhost:3000
🌍 CORS origins: http://localhost:5174
```

### 3. Test Frontend
```bash
cd ../Auto-Advertisment-Frontend
npm run dev
```

### 4. Test Login
- Click "Sign in with Google"
- Should work without CORS error
- Check Network tab: Status 200 ✅

### 5. Test BusinessSwitcher
- Look at sidebar (left side)
- Should see business icon above logout
- Click it → dropdown opens OVER content
- Select business → data refreshes

---

## Verification Checklist

### CORS Fix
- [ ] `.env` has correct `FRONTEND_URLS`
- [ ] Backend restarted
- [ ] Login works without CORS error
- [ ] Console shows `🌍 CORS origins: http://localhost:5174`

### BusinessSwitcher Positioning
- [ ] Button visible in sidebar
- [ ] Clicking opens dropdown
- [ ] Dropdown appears ABOVE content (not hidden)
- [ ] Dropdown has strong shadow (visible)
- [ ] Can click items in dropdown

### Business Hydration
- [ ] Switch business → loading spinner shows
- [ ] After switch → business details update
- [ ] After switch → products update
- [ ] Console shows: "Business details refreshed ✅"
- [ ] Console shows: "Products refreshed ✅"

---

## Files Modified

### Backend
- ✅ `index.js` - Enhanced CORS configuration
  - Added methods array
  - Added allowedHeaders
  - Added OPTIONS handler

### Frontend
- ✅ `components/Dashboard/Sidebar.tsx` - Added z-index: 1000
- ✅ `components/Dashboard/BusinessSwitcher.tsx` - z-index: 10000, enhanced shadow
- ✅ `store/listenerMiddleware.ts` - Fetch business + products on switch

---

## Common Issues

### "Still getting CORS error"
1. Did you update `.env`?
2. Did you restart the backend server?
3. Check backend console - what does it say for CORS origins?
4. Clear browser cache and hard reload (Ctrl+Shift+R)

### "BusinessSwitcher still hidden"
1. Hard reload frontend (Ctrl+Shift+R)
2. Check browser DevTools → Elements → Find the dropdown
3. Check computed styles → z-index should be 10000

### "Business data not updating"
1. Open browser console
2. Switch business
3. Look for "[Listener] Business switched..." logs
4. Check for error messages

---

## Debug Commands

### Check CORS Configuration
```bash
# In backend console, you should see:
🌍 CORS origins: http://localhost:5174
```

### Test CORS with curl
```bash
curl -X OPTIONS http://localhost:3000/auth/google \
  -H "Origin: http://localhost:5174" \
  -H "Access-Control-Request-Method: POST" \
  -v
```

Should return headers with:
```
Access-Control-Allow-Origin: http://localhost:5174
Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS
```

### Check Frontend Console
```javascript
// Should see these logs when switching business:
[Listener] Business switched to abc123, rehydrating data...
[Listener] ✅ Business details refreshed
[Listener] ✅ Products refreshed
```

---

## Environment Variables Template

Create `Auto-Advertisment-Backend/.env`:

```env
# Server
PORT=3000

# CORS - IMPORTANT! Match your frontend URL
FRONTEND_URLS=http://localhost:5174

# JWT (can use defaults)
JWT_SECRET=super_secret_key
ACCESS_TOKEN_EXPIRES_IN=1h
REFRESH_TOKEN_EXPIRES_IN=7d

# Firebase - REQUIRED
FIREBASE_API_KEY=your_firebase_key_here
GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json
FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com

# OpenAI - REQUIRED for AI features
OPENAI_API_KEY=sk-your-key-here
OPENAI_ORG_ID=org-your-org-here

# Google OAuth - REQUIRED for Google Sign-In
GOOGLE_WEB_CLIENT_ID=your-client-id.apps.googleusercontent.com

# Environment
NODE_ENV=development
LOG_LEVEL=debug
```

---

## Next Steps After Fixes

1. ✅ Verify login works
2. ✅ Verify BusinessSwitcher visible
3. ✅ Create a test business
4. ✅ Add a second business
5. ✅ Switch between businesses
6. ✅ Verify data updates correctly
7. ✅ Test product creation in each business
8. ✅ Test socket events work

---

**Status:** 🟢 All fixes implemented and ready to test!

**Last Updated:** October 21, 2025

