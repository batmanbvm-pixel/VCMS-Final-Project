# ⚡ QUICK REFERENCE: TEST COMMANDS & CREDENTIALS

## 🔗 URLs & ACCESS POINTS

```
Frontend: http://localhost:8080
Backend:  http://localhost:5000

DevTools: Press F12 on any page
Responsive Design: Ctrl+Shift+M (Windows/Linux) or Cmd+Shift+M (Mac)
```

---

## 👤 DEMO ACCOUNT CREDENTIALS

```
📊 ADMIN:
   Email:    admin@gmail.com
   Password: Test@1234
   Path:     /admin-dashboard

👨‍⚕️ DOCTOR (alice):
   Email:    alice@gmail.com
   Password: Test@1234
   Path:     /doctor-dashboard

👤 PATIENT (john):
   Email:    john@gmail.com
   Password: Test@1234
   Path:     /patient-dashboard
```

**Alternative Accounts (if primary doesn't work):**
```
Doctor:   rudra12@gmail.com / Preet@2412
Patient:  preet12@gmail.com / Preet@2412
```

---

## 🧪 TESTING CHECKLIST (Copy & Paste)

```
✅ BEFORE YOU START:
  [ ] Both servers running (backend 5000, frontend 8080)
  [ ] Can access http://localhost:8080
  [ ] DevTools open (F12)

✅ DEMO CREDENTIALS:
  [ ] Admin login works
  [ ] Doctor login works
  [ ] Patient login works

✅ CRITICAL FEATURES:
  [ ] Video call shows both cameras
  [ ] Prescription popup works during call
  [ ] AI summary works in English
  [ ] AI summary works in Gujarati
  [ ] AI summary works in Hindi
  [ ] Medical report analyzer works
  [ ] Forgot password OTP works
  [ ] Console has ZERO red errors
  [ ] Network tab has ZERO 404/500 errors

✅ THEME & STYLING:
  [ ] Symptom cards are colorful
  [ ] Favicon is medical symbol
  [ ] Theme is cyan/blue throughout
  [ ] Password strength is text only (no bar)
  [ ] NO horizontal scroll at 1024px

✅ SECURITY:
  [ ] NO "OpenAI" anywhere on page
  [ ] NO "Lovable" platform references
  [ ] Email template uses cyan branding
```

---

## 🔍 QUICK ERROR CHECKS

### Check Console for Errors
```
1. Open http://localhost:8080
2. Press F12
3. Click Console tab
4. Look for RED text (errors)
5. If found, take screenshot and tell me
```

### Check Network for API Errors
```
1. Open http://localhost:8080
2. Press F12
3. Click Network tab
4. Perform action (login, upload, etc)
5. Look for RED status codes (404, 500)
6. If found, take screenshot and tell me
```

### Check Password Strength Display
```
1. Go to Register page
2. Click password field
3. Type: "aaa" → should show "Weak" (text only)
4. Type: "Aaa123" → should show "Medium" (text only)
5. Type: "Aaa123!@#" → should show "Strong" (text only)
6. Should NOT show colored bar (green/red)
```

### Check Video Call
```
1. Login as alice@gmail.com (doctor) - Window A
2. Login as john@gmail.com (patient) - Window B
3. In Window A: Find john's appointment, click "Join Video Call"
4. In Window B: Accept video call when asked
5. Both cameras should appear side-by-side
6. Keep cameras on while testing other features
```

### Check Medical Report Upload
```
1. Login as john@gmail.com (patient)
2. Find "Upload Medical Report" section
3. Upload report 1 → Wait for analysis
4. Upload report 2 → Should show split view
5. Try to upload report 3 → Add button should be BLURRED
6. Check: NO error message, just subtle blur
```

### Check Forgot Password OTP
```
1. Click "Forgot Password" on login page
2. Enter: john@gmail.com
3. Click "Send OTP"
4. Check email inbox (might be in spam)
5. Find 6-digit OTP
6. Paste OTP on page
7. Click "Verify OTP"
8. Enter new password
9. Click "Reset Password"
10. Try login with NEW password (should work)
```

---

## 📱 RESPONSIVE DESIGN CHECK

```
1. Press F12 to open DevTools
2. Press Ctrl+Shift+M (or Cmd+Shift+M on Mac)
3. Change width to 1024px
4. Scroll horizontally → Should be NO scroll
5. Check all pages at 1024px:
   - Admin Dashboard
   - Doctor Dashboard
   - Patient Dashboard
   - Guest Page
```

---

## 🚨 WHAT TO DO IF YOU FIND AN ERROR

### Step 1: Document the Issue
```
[ ] Name of feature (e.g., "Video Call", "AI Summary")
[ ] URL where it happened (e.g., localhost:8080/doctor-dashboard)
[ ] Exact steps to reproduce
[ ] What you expected to happen
[ ] What actually happened
[ ] Screenshot of error (especially Console error)
```

### Step 2: Tell Me Immediately
```
Send me:
1. Feature name
2. Steps to reproduce
3. Expected vs actual
4. Console error (screenshot)
5. URL
```

### Step 3: Wait for Fix
```
I will:
1. Read your description
2. Find the bug in code
3. Fix it
4. Tell you to re-test
```

### Step 4: Re-Test
```
You will:
1. Perform same steps
2. Verify it works now
3. Check for similar issues
4. Mark as FIXED ✅
```

---

## 🎯 SUCCESS INDICATORS

**When you see these, the feature is working:**

```
✅ Admin Dashboard:
   - Doctor performance table visible
   - All columns show (Name, Specialization, Status)
   - Warn buttons clickable

✅ Doctor Dashboard:
   - Cyan/blue background
   - Appointments table shows
   - Online/Offline toggle works
   - Prescriptions accessible

✅ Patient Dashboard:
   - Symptom cards visible (10 cards, colorful)
   - Appointment table shows
   - "Add Appointment" button visible
   - All cards clickable

✅ Video Call:
   - Both video feeds show (side-by-side)
   - Microphone toggle works
   - Camera toggle works
   - Prescription popup appears WITHOUT leaving call

✅ AI Prescription:
   - Language selector visible (English/Gujarati/Hindi)
   - Summary appears within 3-5 seconds
   - Medicine guide shows:
     * Dosage (e.g., 500mg)
     * Timing (e.g., Twice daily)
     * Meal reference (with/without food)
     * Side effects (4-5+)
   - NO "OpenAI" text anywhere

✅ Medical Reports:
   - Progress bar shows while analyzing
   - Report content displays
   - 2 reports show side-by-side
   - 3+ reports: Add button is BLURRED (not disabled, just blurred)
   - Medical detection message for non-medical docs

✅ OTP Email:
   - Email arrives within 1 minute
   - Email shows 6-digit OTP clearly
   - Email uses cyan/blue colors
   - Subject mentions "MediConnect" (not external brand)
   - OTP verification works
   - New password accepted on next login

✅ Favicon:
   - Browser tab shows medical symbol (⚕️)
   - Symbol is cyan/blue colored
   - Appears on ALL pages
   - NO lovable platform icon

✅ Console:
   - NO red text (error messages)
   - NO "Cannot find" errors
   - NO "undefined" reference errors
   - NO API errors (404, 500)
```

---

## 🏁 FINAL CHECKLIST

When EVERYTHING above is ✅ CHECKED, you can say:

> "The application is complete and ready for viva. All 160 prompts have been implemented and verified. The system has zero console errors, zero API errors, and all major features are functioning correctly."

---

## 📞 QUICK HELP

**Server won't start?**
```bash
# Check if ports are in use
lsof -i :5000   # Backend
lsof -i :8080   # Frontend

# Kill stuck process
kill -9 <PID>

# Restart servers
cd backend/server && npm run dev
cd frontend && npm run dev
```

**Database issues?**
```bash
# Check MongoDB connection string in .env
# Verify MongoDB Atlas is accessible
# Check network IP whitelist in MongoDB
```

**Frontend won't reload?**
```bash
# Clear browser cache (Ctrl+Shift+Delete)
# Hard refresh (Ctrl+F5)
# Restart Vite server
```

**Password reset OTP not arriving?**
```bash
# Check email spam folder
# Check email address is correct (@gmail.com)
# Check .env has correct email config
# Verify email service API keys
```

---

**That's all you need to know. Go test! 🚀**
