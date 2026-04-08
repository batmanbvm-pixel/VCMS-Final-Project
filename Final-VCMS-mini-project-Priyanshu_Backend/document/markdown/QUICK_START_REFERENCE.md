# ⚡ QUICK START REFERENCE GUIDE

**Project:** Virtual Clinic Management System (VCMS)  
**Type:** College Project - Localhost Only  
**Preparation Date:** March 5, 2026

---

## 🚀 START PROJECT (2 Steps)

### Terminal 1 - Backend (Runs on Port 5000)
```bash
cd Final-VCMS-mini-project-Priyanshu_Backend/backend/server
npm run dev
```

✅ **Success when you see:**
```
🚀 Secure VCMS Server running on port 5000
✅ MongoDB Atlas Connected Successfully
```

### Terminal 2 - Frontend (Runs on Port 8081)
```bash
cd Final-VCMS-mini-project-Priyanshu_Backend/frontend
npm run dev
```

✅ **Success when you see:**
```
➜ Local: http://localhost:8081/
```

### Open Browser
```
http://localhost:8081
```

---

## 🔑 LOGIN CREDENTIALS

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@vcms.com | password |
| Doctor | doctor@vcms.com | password |
| Patient | patient@vcms.com | password |

---

## 📍 MAIN URLS

| Page | URL | Feature |
|------|-----|---------|
| **Home** | http://localhost:8081 | Landing, login/register |
| **Browse Doctors** | /doctors | Search doctors, view profiles |
| **Patient Dashboard** | /dashboard | Patient overview |
| **Book Appointment** | /appointments | Create appointments |
| **Prescriptions** | /prescriptions | View medications |
| **Medical History** | /medical-history | View/upload medical records |
| **Doctor Dashboard** | /doctor | Doctor overview |
| **Today Appts** | /doctor/today | Today's appointments |
| **Patient List** | /doctor/patients | Manage patients |
| **Issue Prescription** | /doctor/prescriptions | Create prescriptions |
| **Doctor Feedback** | /doctor/feedback | View patient reviews |
| **Admin Dashboard** | /admin | Admin overview + enhancements |
| **Doctor Performance** | /admin (scroll) | NEW: Sorting, ranking, warnings |
| **Monthly Trends** | /admin (scroll) | NEW: Enhanced chart, cards |
| **Feedback by Doctor** | /admin (scroll) | NEW: Organized reviews |
| **Contacts** | /admin/contacts | NEW: Reply with progress tracking |
| **User Management** | /admin/users | View users by role |
| **Doctor Approvals** | /admin/approvals | Approve pending doctors |
| **Appointments** | /admin/appointments | All appointments |
| **Reviews** | /admin/reviews | All reviews filtering |

---

## ✨ PHASE 1 ENHANCEMENTS (Key Things to Show)

### 1. Doctor Performance Table
- **Location:** Admin Dashboard → scroll down
- **Features:** Sorting buttons, ranking medals, warning system
- **How to use:** Click sort buttons, show color-coded cards
- **Time:** 1 minute

### 2. Monthly Trends Chart
- **Location:** Admin Dashboard → scroll down
- **Features:** Animated chart, 4 summary cards
- **How to use:** Show animation, point out summary metrics
- **Time:** 1 minute

### 3. Patient Feedback by Doctor
- **Location:** Admin Dashboard → scroll down
- **Features:** Reviews grouped by doctor, ratings visible
- **How to use:** Scroll through feedback sections
- **Time:** 1 minute

### 4. Contact Reply System
- **Location:** Admin Dashboard → Contact Tickets
- **Features:** 3-stage progress (Open→Processing→Final)
- **How to use:** Click ticket, move progress bar, add reply
- **Time:** 2 minutes

### 5. Unified Colors
- **Location:** Admin Users page
- **Features:** Admin=Red, Doctor=Green, Patient=Cyan
- **How to use:** Show user list with colors
- **Time:** 30 seconds

---

## 🧪 QUICK DEMO (5 Minutes)

### Flow 1: Patient Books Appointment (2 min)
1. Login as patient@vcms.com
2. Go to /appointments
3. Click "Book Appointment"
4. Select doctor and time
5. Confirm booking

### Flow 2: Admin Reviews System (2 min)
1. Login as admin@vcms.com
2. Go to /admin
3. Scroll down to see:
   - Doctor Performance table with sorting
   - Monthly Trends with summary cards
   - Patient Feedback by Doctor
4. Click on various elements to show interactivity

### Flow 3: Contact Management (1 min)
1. Go to /admin/contacts
2. Click a contact ticket
3. Show 3-stage progress tracker
4. Add admin reply
5. Change stage and save

---

## 🐛 TROUBLESHOOTING

### Backend Won't Start
```bash
killall node npm
sleep 2
cd backend/server && npm run dev
```

### Frontend Won't Start
```bash
killall node npm
sleep 2
cd frontend && npm run dev
```

### Port Already In Use
```bash
# Find what's using the port
lsof -i :5000          # for backend
lsof -i :8081          # for frontend

# Kill the process
kill -9 <PID>

# Or just do
killall node npm
```

### Database Connection Error
- Check internet (MongoDB Atlas is cloud)
- Verify .env has MONGODB_URI
- Check IP whitelist in MongoDB Atlas settings

### Module Not Found
```bash
cd backend/server
rm -rf node_modules package-lock.json
npm install

cd ../../../frontend
rm -rf node_modules package-lock.json
npm install
```

---

## 📊 PROJECT STATS

- **Frontend Pages:** 33
- **Backend Controllers:** 11
- **MongoDB Collections:** 10
- **API Endpoints:** 100+
- **React Routes:** 25+
- **Components:** 17 reusable
- **Code Quality:** 0 errors, 0 warnings
- **Phase 1 Tasks:** 7 completed
- **Phase 2 Cleanup:** 8 items verified

---

## ✅ VERIFICATION CHECKLIST

Before demo:
- [ ] Backend running (check terminal shows success)
- [ ] Frontend running (check terminal shows success)
- [ ] Can access http://localhost:8081
- [ ] Can login with test credentials
- [ ] Doctor performance table visible and sorts
- [ ] Monthly trends chart animates
- [ ] Contact tickets can be opened and replied
- [ ] No console errors (F12 → Console tab)
- [ ] Responsive on mobile view (F12 → mobile mode)

---

## 🎯 KEY POINTS FOR VIVA

1. **Tech Stack:** MERN (MongoDB, Express, React, Node.js)
2. **Architecture:** MVC pattern with proper separation
3. **Security:** JWT auth, role-based access, password hashing
4. **Database:** 10 collections with proper relationships
5. **Features:** Authentication, appointments, prescriptions, reviews, feedback
6. **Phase 1:** 7 admin dashboard enhancements
7. **Phase 2:** Code cleanup, 0 errors
8. **Real-time:** Socket.IO for notifications
9. **Responsive:** Works on desktop and mobile
10. **Production Ready:** For college submission

---

## 📞 COMMON QUESTIONS

**Q: Why localhost only?**
A: College project requirement. Not designed for production deployment.

**Q: Where's the database?**
A: MongoDB Atlas (cloud). Connection string in backend/server/.env

**Q: How long does startup take?**
A: Backend 3-5 seconds, Frontend 5-10 seconds. First time may be slower.

**Q: Can I use different ports?**
A: Change in vite.config.ts (frontend) and server.js (backend), then restart.

**Q: What if I forget test password?**
A: Check backend/server/seeder.js for all default test users.

---

**Last Updated:** March 5, 2026  
**Status:** ✅ Ready for Demonstration  
**Version:** 1.0

**Good luck with your college presentation! 🎓**
