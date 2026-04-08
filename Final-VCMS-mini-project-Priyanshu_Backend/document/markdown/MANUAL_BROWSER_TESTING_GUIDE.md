# 🔍 MANUAL BROWSER TESTING CHECKLIST

**Application URL:** http://localhost:8080  
**Status:** Frontend running ✅ | Backend starting...  
**Test Approach:** Use the checklist below. Test each item. Mark ✅ when working.

---

## STEP 1: CONSOLE ERROR CHECK (CRITICAL)

**HOW TO TEST:**
1. Open http://localhost:8080 in browser
2. Press `F12` to open DevTools
3. Click **Console** tab
4. Look for RED error messages
5. Write down any red errors

**CRITICAL REQUIREMENTS:**
- ✅ NO red error messages in Console
- ✅ NO "Cannot find module" errors
- ✅ NO "undefined" reference errors
- ✅ NO API errors (401, 404, 500)

**If errors found:**
- Take screenshot of error
- Note the exact error message
- Check Network tab (see below)

---

## STEP 2: NETWORK ERROR CHECK

**HOW TO TEST:**
1. Open DevTools (press F12)
2. Click **Network** tab
3. Perform an action (e.g., login, load page)
4. Look for RED items in the list (404, 500 status codes)

**CRITICAL REQUIREMENTS:**
- ✅ NO red status codes (should be blue 200/201 or yellow 304)
- ✅ API calls complete successfully
- ✅ No "net::ERR_CONNECTION_REFUSED" for localhost:5000

**Expected Successful Status Codes:**
- 200 = OK ✅
- 201 = Created ✅
- 304 = Not Modified ✅
- 400/401/403 = Expected sometimes (auth errors) ⚠️
- 404/500 = BAD ❌

---

## STEP 3: DEMO ACCOUNT LOGIN TESTS

### Test 3A: Admin Login

**Credentials:**
- Email: `admin@gmail.com`
- Password: `Test@1234`

**HOW TO TEST:**
1. On login page, see demo credentials card
2. Check it shows `admin@gmail.com / Test@1234` ✅
3. Click the card to auto-fill (if available)
4. Click Login
5. Check console for errors

**EXPECTED RESULT:**
- ✅ Admin dashboard loads
- ✅ "Doctor Performance" table visible
- ✅ Warn buttons present on doctor rows
- ✅ Doctor Name, Specialization, Status columns visible
- ✅ NO errors in Console

---

### Test 3B: Doctor Login

**Credentials:**
- Email: `alice@gmail.com`
- Password: `Test@1234`

**HOW TO TEST:**
1. Login with alice@gmail.com / Test@1234
2. Check Console for errors
3. Verify page loads

**EXPECTED RESULT:**
- ✅ Doctor dashboard loads
- ✅ Cyan/blue tinted background visible
- ✅ Appointments table shows (with "All", "Pending", "Completed" tabs)
- ✅ Online/Offline toggle button visible
- ✅ "Add Prescription" or similar option visible
- ✅ NO errors in Console

---

### Test 3C: Patient Login

**Credentials:**
- Email: `john@gmail.com`
- Password: `Test@1234`

**HOW TO TEST:**
1. Login with john@gmail.com / Test@1234
2. Check Console for errors
3. Verify page loads

**EXPECTED RESULT:**
- ✅ Patient dashboard loads
- ✅ "Patient Portal" header visible
- ✅ Symptom cards visible (colorful, dark background)
- ✅ Appointments table with columns: Doctor Name, Date, Time, Status, Location
- ✅ All 10 symptoms visible: Fever, Headache, Chest Pain, Skin Rash, Joint Pain, Back Pain, Stomach Pain, Acne, Hair Loss, Cough
- ✅ "Add Appointment" or similar button visible
- ✅ NO errors in Console

---

## STEP 4: SYMPTOM CARDS CHECK

**HOW TO TEST:**
1. Go to Patient Dashboard OR Guest Page
2. Look at symptom cards section
3. Check each symptom

**SYMPTOM CARDS CHECKLIST:**
- ✅ Card 1: "Fever" (Red/Warm tone)
- ✅ Card 2: "Headache" (Purple)
- ✅ Card 3: "Chest Pain" (Orange/Red)
- ✅ Card 4: "Skin Rash" (Pink)
- ✅ Card 5: "Joint Pain" (Blue)
- ✅ Card 6: "Back Pain" (Yellow/Gold)
- ✅ Card 7: "Stomach Pain" (Green)
- ✅ Card 8: "Acne" (Light Blue/Cyan)
- ✅ Card 9: "Hair Loss" (Brown)
- ✅ Card 10: "Cough" (Cyan/Blue)

**CARD STYLE REQUIREMENTS:**
- ✅ Dark background theme (not white)
- ✅ Colorful icons/text
- ✅ Cards NOT too big, NOT too small (reasonable padding)
- ✅ ALL cards visible without horizontal scroll
- ✅ Proper margins between cards

---

## STEP 5: VIDEO CALL TEST (Most Critical)

**PRE-REQUISITE:** Must have 2 browser windows/tabs:
- Window A: Logged in as `alice@gmail.com` (Doctor)
- Window B: Logged in as `john@gmail.com` (Patient)

**HOW TO TEST:**
1. In Window A (Doctor): Find patient "john" in appointment list
2. Click "Join" or "Start Video Call" button
3. In Window B (Patient): Should see notification or pop-up to join call
4. Patient clicks "Join Video Call"
5. Wait 2-3 seconds for connection

**CHECKLIST DURING VIDEO CALL:**
- ✅ Doctor's camera visible on screen (live feed)
- ✅ Patient's camera visible on screen (live feed)
- ✅ BOTH cameras showing at same time (side-by-side or one above other)
- ✅ Microphone toggle button works (click and see status change)
- ✅ Camera toggle button works (click and camera goes off/on)
- ✅ "Waiting for patient..." message appears BEFORE patient joins (if applicable)
- ✅ Message disappears once patient joins
- ✅ NO console errors

**PRESCRIPTION POPUP TEST (During Video Call):**
1. Doctor clicks "Add Prescription" or similar button WHILE IN VIDEO CALL
2. Pop-up appears but video call continues in background
3. Check video is STILL showing (not minimized)
4. Doctor fills prescription, clicks save
5. Pop-up closes, video call still visible

**EXPECTED:**
- ✅ Prescription pop-up appears WITHOUT leaving video call
- ✅ Video continues playing in background
- ✅ NO page navigation

---

## STEP 6: AI PRESCRIPTION SUMMARY TEST

**PRE-REQUISITE:** Patient must have at least one prescription

**HOW TO TEST:**
1. Login as `john@gmail.com` / `Test@1234` (Patient)
2. Go to "My Prescriptions" or similar menu
3. Click on a prescription
4. Look for "AI Summary" or "Generate Summary" button
5. Click it

**INITIAL SCREEN:**
- ✅ Language selector appears (English / Gujarati / Hindi dropdown)
- ✅ "Generate" button appears

**AFTER CLICKING GENERATE:**
- ✅ Progress indicator shows (spinning wheel or progress bar)
- ✅ Summary generates (takes 3-5 seconds)
- ✅ NO "OpenAI" text or buttons visible
- ✅ Summary appears with clear sections:
  - "Overview" or "What is this medicine for"
  - "How to Take" (with dosage, timing, meal information)
  - "Side Effects" (list of 4-5 effects)
  - "Precautions"
  - "Duration"

**LANGUAGE TEST:**
1. Generate summary in English first
2. Go back, select Gujarati, generate again
3. Check summary text changed to Gujarati ✅
4. Go back, select Hindi, generate again
5. Check summary text changed to Hindi ✅

**NO OPENAI CHECK:**
- ✅ Button says "AI Summary" (not "OpenAI")
- ✅ No "OpenAI API" text anywhere
- ✅ No "ChatGPT" references
- ✅ Only "Gemini" or "Google AI" should be mentioned (if mentioned at all)

---

## STEP 7: MEDICAL REPORT ANALYZER TEST

**PRE-REQUISITE:** Have 2-3 sample medical documents ready (PDF or image)

**HOW TO TEST:**
1. Login as `john@gmail.com` / `Test@1234` (Patient)
2. Find "Upload Medical Report" or "Medical Report Analyzer" section
3. Click "Upload" button

**TEST A: Single Report Upload**
1. Upload 1 medical document
2. Wait for OCR to process (progress bar should show)
3. Check result displays:
   - ✅ "What this report is about" section
   - ✅ "Step-by-step guide" with explanation
   - ✅ "Important findings" explained in simple language
   - ✅ "What to watch for" (warnings/alerts)

**TEST B: Two Reports Upload**
1. Upload 1st medical document
2. Upload 2nd medical document
3. Check layout:
   - ✅ Reports show side-by-side (split view)
   - ✅ Both reports visible on same screen
   - ✅ Each has own analysis section

**TEST C: Three or More Reports (Should Show Blur)**
1. Upload 1st report
2. Upload 2nd report
3. Try to upload 3rd report
4. Check:
   - ✅ "Add" button appears but is BLURRED
   - ✅ Blur is subtle (blur-2px) - can still see button through blur
   - ✅ Button is disabled or shows message: "Max 2 reports allowed"
   - ✅ NO error message (just graceful blur)

**PROGRESS BAR TEST:**
- ✅ Progress bar appears while analyzing (0-100%)
- ✅ Progress never exceeds 100%
- ✅ Completes and disappears

**MEDICAL DETECTION TEST:**
1. Try uploading a NON-medical image (e.g., random photo, screenshot)
2. Check message:
   - ✅ Should show: "Non-medical document detected. Upload lab reports, prescriptions, or imaging reports for best results."
   - ✅ NOT show: "Error processing image"

**OCR TEST:**
1. Upload a document with clear text
2. Check if text is extracted and analyzed
3. Result should reference actual text from document ✅

---

## STEP 8: PASSWORD & AUTHENTICATION TESTS

### Test 8A: Forgot Password

**HOW TO TEST:**
1. Click "Forgot Password" on login page
2. Enter email address: `john@gmail.com`
3. Click "Send OTP"
4. Check:
   - ✅ Email validation works (should accept @gmail.com)
   - ✅ Message appears: "OTP sent to your email"

**IN EMAIL CLIENT:**
1. Check email inbox (might be in spam)
2. Find email from "MediConnect"
3. Check email contains:
   - ✅ OTP code (6 digits, clearly visible, large text)
   - ✅ Email template uses CYAN/BLUE colors
   - ✅ Subject mentions "Password Reset OTP"
   - ✅ Branding says "MediConnect" (not "Lovable" or external brand)

**OTP VERIFICATION:**
1. Copy OTP from email
2. Paste into OTP field on forgot password page
3. Click "Verify OTP"
4. Check:
   - ✅ Message shows "OTP verified"
   - ✅ "Set New Password" field appears

**NEW PASSWORD:**
1. Enter new password in field
2. Check password strength indicator shows: "Weak" / "Medium" / "Strong" (TEXT ONLY, no colored bar)
3. Password requirements visible (should need: 8+ chars, 1 uppercase, 1 number, 1 special char)
4. Click "Reset Password"
5. Check:
   - ✅ Message shows "Password reset successfully"
   - ✅ Redirected to login page
   - ✅ NEW password works on login

### Test 8B: Edit Profile Password Change

**HOW TO TEST:**
1. Login with `john@gmail.com` / `Test@1234`
2. Go to "Profile" or "Account Settings"
3. Click "Change Password"
4. Enter current password: `Test@1234`
5. Enter new password
6. Click "Save"
7. Check:
   - ✅ Message shows "Password updated"
   - ✅ NEW password works on next login
   - ✅ OTP verification works (should have received OTP email)

---

## STEP 9: HORIZONTAL SCROLL CHECK

**HOW TO TEST:**
1. Open DevTools (F12)
2. Click **Responsive Design Mode** or use keyboard shortcut (Ctrl+Shift+M)
3. Set width to **1024px**
4. Visit each page:
   - Admin Dashboard
   - Doctor Dashboard
   - Patient Dashboard
   - Guest Page
5. For each page, check:
   - ✅ NO horizontal scroll bar at bottom
   - ✅ NO overflow content
   - ✅ Tables are responsive (wrap or scroll internally, not page)
   - ✅ All content readable at 1024px width

---

## STEP 10: PASSWORD STRENGTH DISPLAY

**HOW TO TEST:**
1. Go to Register page
2. Click on Password field
3. Start typing password
4. Check display shows:
   - ✅ Text only: "Weak" (when password < 8 chars)
   - ✅ Text only: "Medium" (when 8+ chars but missing uppercase/number/special)
   - ✅ Text only: "Strong" (when all requirements met)
   - ✅ NO colored bar (old style)
   - ✅ NO green/red highlighting
   - ✅ Requirements visible below password field:
     - At least 8 characters
     - At least 1 uppercase letter
     - At least 1 number
     - At least 1 special character (@$!%*?&)

---

## STEP 11: FAVICON CHECK

**HOW TO TEST:**
1. Open http://localhost:8080
2. Check browser tab icon (top-left of tab):
   - ✅ Should show medical symbol: ⚕️ (staff with serpent)
   - ✅ Should be CYAN/BLUE color
   - ✅ Should NOT be lovable icon (circle with ❤️)
   - ✅ Should NOT be external platform icon

**HOW TO VERIFY IN CODE:**
1. Right-click page → "View Page Source"
2. Press Ctrl+F, search for "favicon"
3. Check line shows: `<link rel="icon" type="image/svg+xml" href="/favicon.svg" />`
4. Check it does NOT say "lovable" or external CDN

---

## STEP 12: THEME CONSISTENCY CHECK

**HOW TO TEST:**
1. Visit Admin Dashboard
2. Visit Doctor Dashboard
3. Visit Patient Dashboard
4. Visit Guest Page
5. For each, check:
   - ✅ Cyan/blue color theme throughout
   - ✅ Consistent button colors
   - ✅ Consistent background colors
   - ✅ Consistent text colors
   - ✅ NO purple, orange, or other clashing colors
   - ✅ All interactive elements (buttons, links) use project colors

---

## FINAL CHECKLIST

When you've completed all steps above, verify:

### CRITICAL ITEMS (MUST PASS)
- [ ] NO console errors (red text in F12 Console)
- [ ] NO API errors (404, 500 in Network tab)
- [ ] All 3 demo accounts login successfully
- [ ] Video call shows both cameras
- [ ] Prescription popup works in video call
- [ ] AI summary generates in all 3 languages
- [ ] Medical report analyzer works with OCR
- [ ] Forgot password OTP flow works end-to-end
- [ ] Favicon is medical symbol (not external)
- [ ] NO OpenAI/Lovable references

### IMPORTANT ITEMS (SHOULD PASS)
- [ ] Symptom cards are colorful and same style everywhere
- [ ] Password strength shows text only (no bar)
- [ ] NO horizontal scroll on any page at 1024px
- [ ] Theme is consistent cyan/blue

### NICE-TO-HAVE ITEMS
- [ ] Email template uses cyan branding
- [ ] Progress bars look smooth
- [ ] Blur effect on 3+ reports is subtle

---

## ISSUES FOUND

**If you find any issues, document them below:**

### Issue 1: [TITLE]
- **Description:** [What's wrong]
- **Steps to Reproduce:** [How to see the problem]
- **Expected:** [What should happen]
- **Actual:** [What actually happens]
- **Screenshot:** [Attach if possible]

### Issue 2: [TITLE]
- **Description:** 
- **Steps to Reproduce:** 
- **Expected:** 
- **Actual:** 
- **Screenshot:**

---

## NEXT STEPS

1. ✅ **You:** Test each item in the checklist above
2. 🔧 **Me:** Fix any issues you find (using code updates)
3. ✅ **You:** Re-test fixed items
4. 🎓 **Result:** When all pass → "VIVA READY" ✅

---

**NOTE:** If you encounter ANY error, please:
1. Take a screenshot of the Console error (F12)
2. Note the exact steps to reproduce
3. Copy the error message text
4. Share it so I can fix the code immediately

This is a team effort. You provide the eyes, I provide the fixes. We'll make it 100% perfect! 🚀
