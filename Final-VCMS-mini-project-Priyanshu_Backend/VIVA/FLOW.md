# System Flow & Architecture Diagrams
## Virtual Clinic Management System (VCMS)

---

## 1️⃣ OVERALL SYSTEM ARCHITECTURE

```mermaid
graph TB
    subgraph "Client Layer"
        BP["👤 Browser<br/>Port 3000<br/>React + Vite"]
    end
    
    subgraph "Server Layer"
        BE["🟢 Backend<br/>Port 5000<br/>Express.js"]
        WSS["🔄 WebSocket<br/>Socket.IO<br/>Real-time"]
    end
    
    subgraph "Data Layer"
        DB["🍃 MongoDB<br/>10 Collections<br/>Indexed Queries"]
    end
    
    subgraph "External Services"
        AI["🤖 OpenAI API<br/>Document Analysis<br/>GPT-4"]
        OCR["📄 Tesseract.js<br/>PDF Parsing<br/>Image OCR"]
    end
    
    BP -->|HTTP/REST| BE
    BP -->|WebSocket| WSS
    BE -->|Mongoose| DB
    BE -->|Async| AI
    BE -->|Async| OCR
    WSS -->|Events| BP
    WSS -->|Emit| DB
    
    style BP fill:#e1f5ff
    style BE fill:#c8e6c9
    style DB fill:#fff9c4
    style AI fill:#f8bbd0
    style OCR fill:#f8bbd0
    style WSS fill:#dcedc8
```

---

## 2️⃣ USER AUTHENTICATION & AUTHORIZATION FLOW

```mermaid
sequenceDiagram
    participant U as User Browser
    participant F as React Frontend
    participant B as Node/Express Backend
    participant DB as MongoDB (users)
    participant CS as Cookie Store

    rect rgb(200, 230, 201)
    Note over U,DB: REGISTRATION FLOW
    U->>F: Fill registration form
    F->>F: Validate client-side
    F->>B: POST /api/auth/register<br/>(firstName, lastName, email, password, role)
    activate B
    B->>B: Validate all fields<br/>- Email domain (Gmail only)<br/>- Phone (10 digits)<br/>- Password strength (8+ chars, 1 upper, 1 num, 1 special)<br/>- Age check if patient (18+)
    B->>DB: Check email/phone exists
    DB-->>B: Not found ✓
    B->>B: Hash password with bcrypt (salt: 10)
    B->>DB: Create new user<br/>approvalStatus = "pending"
    DB-->>B: User saved with _id
    B->>B: Generate JWT token
    deactivate B
    B-->>F: 201 Created<br/>{ message, user, token: null }
    F-->>U: Show: "Awaiting admin approval"
    end

    rect rgb(220, 230, 241)
    Note over U,DB: LOGIN FLOW
    U->>F: Enter email + password
    F->>F: Validate email/password<br/>Check localStorage token
    F->>B: POST /api/auth/login<br/>(email, password)
    activate B
    
    B->>B: Validate inputs
    B->>DB: Find user by email
    DB-->>B: User found
    
    alt User not found
        B-->>F: 401 Unauthorized<br/>Invalid Email or Password
    else Email domains wrong
        B-->>F: 400 Bad Request<br/>Gmail only allowed
    else Account locked (5+ failed attempts)
        B-->>F: 401 Locked<br/>remainingMinutes, unlocksAt
    else Suspended account
        B-->>F: 403 Forbidden<br/>Account suspended
    else Pending/Rejected approval
        B-->>F: 403 Forbidden<br/>Awaiting/Denied approval
    else Password incorrect
        B->>B: Record failed attempt<br/>failedLoginAttempts++
        B->>DB: Save user
        B-->>F: 401 Unauthorized
    else SUCCESS
        B->>B: Clear attempts<br/>lastLoginAt = now()
        B->>B: Generate token pair:<br/>accessToken (15 min)<br/>refreshToken (7 days)
        B->>DB: Save refreshToken to user.refreshTokens[]
        B->>DB: Save user
        B-->>CS: Set httpOnly cookie<br/>(refreshToken)
        deactivate B
        B-->>F: 200 OK<br/>{ token, accessToken,<br/>refreshToken, user }
    end
    
    F->>F: Save accessToken<br/>to localStorage
    F-->>U: Redirect to /dashboard
    end

    rect rgb(255, 243, 224)
    Note over U,DB: PROTECTED ROUTE ACCESS
    U->>F: User clicks protected page
    F->>F: Check localStorage<br/>for accessToken
    
    alt Token missing
        F-->>U: Redirect to /login
    else Token exists
        F->>B: GET /api/appointments<br/>Header: Authorization<br/>'Bearer {accessToken}'
        activate B
        B->>B: Middleware: verify JWT<br/>Extract userId, role
        B->>DB: Check user exists<br/>Check role permissions
        
        alt Token invalid/expired<br/>& refreshToken exists
            B-->>F: 401 Unauthorized<br/>Token expired
            F->>B: POST /api/auth/refresh-token<br/>(refreshToken)
            B->>B: Verify refreshToken
            B->>DB: Check token in user.refreshTokens[]
            B->>B: Generate new accessToken
            B-->>F: 200 { newAccessToken }
            F->>F: Update localStorage
            F->>B: Retry original request with new token
        else Token valid
            B->>DB: Query appointments<br/>Filter by userId
            DB-->>B: Return documents
            deactivate B
            B-->>F: 200 OK { appointments: [...] }
        else No valid refresh token
            F-->>U: Redirect to /login
        end
    end
    end

    rect rgb(243, 229, 245)
    Note over U,DB: LOGOUT FLOW
    U->>F: Click Logout button
    F->>B: POST /api/auth/logout<br/>Header: Authorization
    activate B
    B->>B: Extract userId from token
    B->>DB: Find user
    B->>DB: Remove refreshToken from array
    B->>DB: Set lastLogoutAt = now()
    B->>DB: Save user
    deactivate B
    B-->>CS: Clear refreshToken cookie
    B-->>F: 200 { message: "Logged out" }
    F->>F: Clear localStorage token
    F-->>U: Redirect to /login
    end
```

---

## 3️⃣ DOCTOR-PATIENT APPOINTMENT BOOKING FLOW

```mermaid
sequenceDiagram
    participant P as Patient Client
    participant F as React Frontend
    participant B as Node/Express
    participant DB as MongoDB
    participant IO as Socket.IO
    participant D as Doctor Client

    rect rgb(200, 230, 201)
    Note over P,D: PATIENT BOOKING APPOINTMENT
    
    P->>F: View available doctors
    F->>B: GET /api/public/doctors
    B->>DB: Query User.find({role:'doctor', approvalStatus:'approved'})
    DB-->>B: Return doctors list
    B-->>F: 200 { doctors: [...] }
    F-->>P: Display doctors with availability
    
    P->>F: Select doctor + date/time
    F->>F: Validate selection
    F->>B: GET /api/appointments/available-slots?doctorId=XXX
    B->>DB: Query doctor availability
    B->>DB: Query existing appointments
    B->>B: Calculate free slots
    B-->>F: 200 { availableSlots: [14:00, 14:30, 15:00, ...] }
    F-->>P: Show time picker
    
    P->>F: Confirm appointment
    F->>B: POST /api/appointments<br/>{ doctorId, date, time, symptoms }
    activate B
    
    B->>B: Validate inputs
    B->>B: Check patient approval status
    B->>DB: Check slot still available
    alt Slot taken
        B-->>F: 409 Conflict
    else SUCCESS
        B->>DB: Create appointment<br/>status = "pending"
        B->>DB: Save appointment
        deactivate B
        B->>IO: Socket: emit to doctor<br/>'appointment:new'<br/>{ patientName, symptoms, time }
        B-->>F: 201 Created<br/>{ appointment: { _id, status: 'pending' } }
        io->>D: 🔔 New appointment request
    end
    
    F-->>P: Show "Awaiting doctor confirmation"
    
    end

    rect rgb(220, 230, 241)
    Note over P,D: DOCTOR RESPONSE
    
    D->>F: View pending appointments
    F->>B: GET /api/appointments/today
    B->>DB: Query appointments where<br/>doctorId=XXX, status='pending'<br/>date = today
    DB-->>B: Return list
    B-->>F: 200 { appointments: [...] }
    F-->>D: Show appointment cards
    
    alt Doctor accepts
        D->>F: Click "Accept"
        F->>B: POST /api/appointments/{id}/accept
        activate B
        B->>DB: Update appointment<br/>status = "confirmed"
        B->>DB: Create notification<br/>to patient
        B->>DB: Save
        deactivate B
        B->>IO: Socket: emit to patient<br/>'appointment:confirmed'
        B-->>F: 200 { appointment: { status: 'confirmed' } }
        io->>P: ✅ Appointment confirmed!
    
    else Doctor rejects
        D->>F: Click "Reject" + reason
        F->>B: POST /api/appointments/{id}/reject<br/>{ reason }
        activate B
        B->>DB: Update appointment<br/>status = "rejected"
        B->>DB: Create notification to patient
        deactivate B
        B->>IO: Socket: emit to patient<br/>'appointment:rejected'<br/>{ reason }
        B-->>F: 200
        io->>P: ❌ Appointment rejected
    end
    
    end

    rect rgb(255, 243, 224)
    Note over P,D: APPOINTMENT EXECUTION (Video)
    
    P->>F: At appointment time, click "Join"
    F->>B: POST /api/video/create-room<br/>{ appointmentId }
    activate B
    B->>DB: Create VideoSession<br/>roomId = uuid()<br/>status = "waiting"
    B->>DB: Save
    deactivate B
    B-->>F: 200 { roomId }
    F->>IO: Socket: connect to room<br/>emit "join-room"
    
    D->>F: At appointment time, click "Start Consultation"
    D->>IO: Socket: connect to room
    
    IO-->>P: User joined
    IO-->>D: User joined
    
    P<-->D: WebRTC video/audio<br/>via Socket.IO ICE candidates
    
    P->>F: Complete consultation
    F->>B: PUT /api/appointments/{id}/status<br/>{ status: "completed" }
    B->>DB: Update status, actualEndTime
    B->>DB: Update VideoSession<br/>status = "ended", endTime
    B-->>F: 200
    
    D->>F: Create prescription
    F->>B: POST /api/prescriptions<br/>{ appointmentId, medications: [...],<br/>diagnosis, treatmentPlan }
    B->>DB: Create prescription<br/>status = "draft"
    B-->>F: 200
    
    D->>F: Click "Issue Prescription"
    F->>B: POST /api/prescriptions/{id}/issue
    B->>DB: Update prescription<br/>status = "issued"<br/>issuedAt = now()
    B->>DB: Create notification<br/>to patient
    B->>IO: Socket: emit to patient<br/>'prescription:issued'
    B-->>F: 200
    io->>P: 📋 New prescription available
    
    end
```

---

## 4️⃣ MEDICAL DOCUMENT ANALYSIS (OCR + AI)

```mermaid
sequenceDiagram
    participant P as Patient
    participant F as Frontend
    participant B as Backend
    participant OCR as Tesseract.js
    participant AI as OpenAI API
    participant DB as MongoDB

    rect rgb(255, 243, 224)
    Note over P,DB: DOCUMENT UPLOAD & ANALYSIS FLOW
    
    P->>F: Go to AI Analyzer page
    F-->>P: Show upload form
    P->>F: Select image/PDF file
    F->>F: Validate file type<br/>(jpg, png, pdf only)<br/>Max 10MB
    
    P->>F: Click "Analyze Document"
    F->>F: Show loading spinner
    F->>B: POST /api/ai/analyze-document<br/>FormData:<br/>- file (binary)<br/>- documentType ("prescription" | "lab_report")
    
    activate B
    B->>B: Verify JWT token
    B->>B: Validate file on server
    B->>B: Extract base64 from file/stream
    
    alt PDF File
        B->>OCR: pdfParse(buffer)
        OCR-->>B: Return text content
    else Image File
        B->>OCR: Tesseract.recognize(image)<br/>Language: English
        OCR-->>B: Return extracted text
    else Error
        B-->>F: 400 Invalid file
    end
    
    B->>B: Validate English-only text
    B->>AI: Call OpenAI GPT-4<br/>Prompt: "Analyze prescription..."<br/>+ extracted text<br/>Return JSON format
    activate AI
    
    AI-->>B: JSON response:<br/>{ medications: [...],<br/>diagnosis,<br/>dosages,<br/>sideEffects,<br/>warnings }
    deactivate AI
    
    B->>B: Parse and validate JSON response
    B->>B: Check for language<br/>Reject if non-English
    
    alt Analysis Success
        B->>DB: Save MedicalReport collection<br/>{ userId, file, analysis,<br/>documentType, status, createdAt }
        deactivate B
        B-->>F: 200 { analysis: {...} }
        F->>F: Parse JSON response
        F-->>P: Display analysis:<br/>- Medication cards<br/>- Dosage info<br/>- Warnings/side effects<br/>- Doctor contact
    else Analysis Failed
        B-->>F: 400 { error: "..."  }
        F-->>P: Show error message
    end
    
    end
```

---

## 5️⃣ ADMIN APPROVAL & USER MANAGEMENT

```mermaid
sequenceDiagram
    participant AD as Admin
    participant F as Frontend
    participant B as Backend
    participant DB as MongoDB
    participant IO as Socket.IO
    participant D as Doctor

    rect rgb(243, 229, 245)
    Note over AD,D: DOCTOR APPROVAL WORKFLOW
    
    Note over AD,D: (When doctor registers, sends socket event)
    
    AD->>F: Login as admin
    F->>B: GET /api/admin/dashboard-stats
    B->>DB: Count pending doctors, users, appointments
    B-->>F: 200 { stats: {...} }
    F-->>AD: Show dashboard with "5 Pending Approvals"
    
    AD->>F: Click "Approvals"
    F->>B: GET /api/admin/doctors/pending-list
    B->>DB: Query User.find({role:'doctor',<br/>approvalStatus:'pending'})
    DB-->>B: Return list
    B-->>F: 200 { pendingDoctors: [...] }
    F-->>AD: Show doctor cards with details
    
    alt Admin approves doctor
        AD->>F: Click "Approve" on doctor
        F->>B: POST /api/admin/doctors/{doctorId}/approve
        activate B
        B->>DB: Update user<br/>approvalStatus = "approved"<br/>approvedAt = now()
        B->>DB: Create notification<br/>to doctor: "Your registration approved"
        deactivate B
        B->>IO: Socket: emit to doctor<br/>'doctor:approval-changed'<br/>{ status: 'approved' }
        B-->>F: 200
        io->>D: ✅ Registration approved!<br/>You can now login
        F->>F: Remove from list
        F-->>AD: Show success message
    
    else Admin rejects doctor
        AD->>F: Click "Reject" + reason
        F->>B: POST /api/admin/doctors/{doctorId}/reject<br/>{ reason }
        activate B
        B->>DB: Update user<br/>approvalStatus = "rejected"<br/>rejectionReason = reason
        B->>DB: Create notification to doctor
        deactivate B
        B->>IO: Socket: emit<br/>'doctor:rejected'<br/>{ reason }
        B-->>F: 200
        io->>D: ❌ Registration rejected<br/>Reason: ...
        F-->>AD: Show success
    end
    
    end

    rect rgb(220, 230, 241)
    Note over AD,D: USER MANAGEMENT
    
    AD->>F: Click "Users"
    F->>B: GET /api/admin/users?role=&status=&page=1
    B->>DB: Query users with filters<br/>Pagination: limit 20
    DB-->>B: Return users
    B-->>F: 200 { users: [...], total, pages }
    F-->>AD: Show users table
    
    alt Delete user
        AD->>F: Click delete icon on user
        F->>B: DELETE /api/admin/users/{userId}
        B->>DB: Check user role
        B->>DB: Delete user
        B->>DB: Cascade delete their:<br/>- Appointments<br/>- Prescriptions<br/>- Medical histories
        B-->>F: 200
        F->>F: Refresh table
    else Warn user
        AD->>F: Click "Warn" + message
        F->>B: PUT /api/admin/users/{userId}/warn<br/>{ message }
        B->>DB: Add warning to user.warnings[]<br/>warningCount++
        B->>DB: Create notification
        B-->>F: 200
        IO-->>affected: ⚠️ Admin warning received
    else Change role
        AD->>F: Change user role (patient→doctor)
        F->>B: PUT /api/admin/users/{userId}/role<br/>{ newRole }
        B->>DB: Validate role change
        B->>DB: Update user.role
        B-->>F: 200
    end
    
    end
```

---

## 6️⃣ REAL-TIME NOTIFICATIONS

```mermaid
graph LR
    subgraph "Event Sources"
        A1["📅 New Appointment"]
        A2["✅ Appointment Confirmed"]
        A3["📋 Prescription Issued"]
        A4["⚠️ Admin Warning"]
    end
    
    subgraph "Notification System"
        N["🔔 Create Notification<br/>userId, type, message"]
        Q["📨 Queue Message"]
        S["🔄 Socket.IO Broadcast"]
    end
    
    subgraph "Recipient"
        DB[(Save to<br/>notifications<br/>collection)]
        UI["Update UI<br/>Toast alert<br/>Count badge"]
    end
    
    A1 -->|trigger| N
    A2 -->|trigger| N
    A3 -->|trigger| N
    A4 -->|trigger| N
    
    N -->|save| DB
    N -->|emit| Q
    Q -->|broadcast| S
    S -->|real-time| UI

    style N fill:#fff9c4
    style S fill:#dcedc8
    style UI fill:#c8e6c9
```

---

## 7️⃣ ROLES & PERMISSIONS MATRIX

```
ROUTE                                  PATIENT  DOCTOR   ADMIN   PUBLIC
POST   /api/auth/register                ✅       ✅       ✅       ✅
POST   /api/auth/login                   ✅       ✅       ✅       ✅
GET    /api/public/doctors                ✅       ✅       ✅       ✅
POST   /api/appointments                  ✅       ❌       ❌       ❌
POST   /api/appointments/:id/accept       ❌       ✅       ❌       ❌
GET    /api/prescriptions                 ✅       ✅       ✅       ❌
POST   /api/prescriptions/:id/issue       ❌       ✅       ❌       ❌
GET    /api/admin/users                   ❌       ❌       ✅       ❌
DELETE /api/admin/users/:id               ❌       ❌       ✅       ❌
GET    /api/medical-history               ✅       ✅       ✅       ❌
POST   /api/consultations                 ✅       ✅       ✅       ❌
GET    /api/notifications                 ✅       ✅       ✅       ❌
```

---

## 8️⃣ ERROR HANDLING FLOW

```mermaid
flowchart TD
    A["HTTP Request"] -->|Reaches Backend| B{"Middleware<br/>Validation"}
    
    B -->|Invalid| C["Return 400<br/>Bad Request"]
    B -->|Not Authenticated| D["Return 401<br/>Unauthorized"]
    B -->|No Permission| E["Return 403<br/>Forbidden"]
    B -->|Valid| F{"Controller<br/>Logic"}
    
    F -->|Success| G["Return 200<br/>or 201"]
    F -->|Resource not found| H["Return 404<br/>Not Found"]
    F -->|Database error| I["Return 500<br/>Server Error"]
    F -->|Resource exists| J["Return 409<br/>Conflict"]
    
    C -->|Error| K["Global Error Handler"]
    D -->|Error| K
    E -->|Error| K
    H -->|Error| K
    I -->|Error| K
    J -->|Error| K
    
    K -->|Log error| L["Error logged<br/>in development"]
    K -->|Hide details| M["Send safe response<br/>to client"]
    
    M -->|Response| N["Browser receives<br/>error code + message"]
    N -->|Handle gracefully| O["Show user-friendly<br/>error message"]
```

---

## ✅ FLOW VERIFICATION

- [x] Registration → approval → login flow complete
- [x] JWT token + refresh token system implemented
- [x] Doctor-patient appointment flow end-to-end
- [x] Video consultation with Socket.IO
- [x] Document analysis with OCR + AI
- [x] Real-time notifications via Socket.IO
- [x] Admin approval and user management
- [x] Role-based access control on all routes
- [x] Error handling with proper status codes
- [x] Cascade delete for data integrity

