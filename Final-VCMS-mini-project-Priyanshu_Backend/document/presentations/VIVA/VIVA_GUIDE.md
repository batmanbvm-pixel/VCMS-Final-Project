# 🎓 Complete MERN Stack Viva Guide
## From Zero Knowledge to Expert Interview Ready

**Last Updated**: March 2, 2026  
**For**: Virtual Clinic Management System (VCMS)  
**Audience**: College Project Viva, Technical Interviews, Hiring Managers

---

## PART 1 — WHAT IS MERN? (The Big Picture)

### The Simple Definition
**MERN** = 4 separate technologies working **together** to build a complete web application, from what users see on their screen to the server logic that stores data.

Think of it like a restaurant:
- **MongoDB** = Kitchen storage & inventory system
- **Express** = Kitchen manager (takes orders, organizes workers)
- **React** = Menu & dining area (what customers see & interact with)
- **Node.js** = The engine that powers everything

### How Data Flows (The Journey)
```
User browser (React)
    ↓ (clicks "Book Appointment")
React sends HTTP request
    ↓
Express server receives request
    ↓
Express checks: "Is this user logged in? Do they have permission?"
    ↓
Express queries MongoDB: "Get all doctors in Mumbai"
    ↓
MongoDB returns data
    ↓
Express sends response back
    ↓
React receives data
    ↓
React displays doctors on browser
    ↓
User is happy! 😊
```

### Why These 4 Technologies?

| Technology | Why Choose | What It Does |
|-----------|-----------|-------------|
| **MongoDB** | Flexible JSON storage | Stores unstructured medical data perfectly |
| **Express** | Lightweight, fast | Handles 1000s of requests per second |
| **React** | Component-based UI | Create reusable UI pieces (buttons, cards, forms) |
| **Node.js** | Uses JavaScript everywhere | Same language frontend & backend = faster development |

### Very First Distinction: Frontend vs Backend

**Frontend (React)**: What user sees and clicks on
- Runs in browser
- 3000 (localhost)
- File: src/pages/PatientDashboard.tsx
- Can read from localStorage
- Calls backend APIs

**Backend (Express)**: Server logic and database
- Runs on server
- Port 5000 (localhost)
- Files: server/routes/*, server/controllers/*
- Has access to secrets/API keys
- Stores sensitive data

---

## PART 2 — MONGODB (The Database)

### What is a Database?
A database is like a massive organized filing cabinet. Instead of physical files, it stores digital data in a structured way.

**SQL databases** (MySQL, PostgreSQL) = Data in tables with fixed columns
```
USERS TABLE
ID | Name      | Email
1  | Raj Patel | raj@gmail.com
2  | Priya S   | priya@gmail.com
```

**NoSQL databases** (MongoDB) = Data as JSON documents (no fixed columns)
```
USERS COLLECTION
{
  "_id": 1,
  "name": "Raj Patel",
  "email": "raj@gmail.com",
  "phone": "9876543210"
}

{
  "_id": 2,
  "name": "Priya S",
  "email": "priya@gmail.com",
  "phone": "9123456789",
  "specialization": "Cardiology"  ← Can add new fields!
}
```

### Key Concepts

#### 1. Collections (= Tables)
```javascript
// MongoDB has "collections" (like table names)
db.users        // Collection of users
db.appointments // Collection of appointments
db.prescriptions // Collection of prescriptions
```

#### 2. Documents (= Records)
```javascript
// One document (like one row)
{
  "_id": ObjectId("63f7a1b2c3d4e5f6g7h8i9"),  // Auto-ID
  "name": "Dr. Raj Kumar",
  "email": "dr.raj@gmail.com",
  "role": "doctor",
  "specialization": "Surgery",
  "rating": 4.5,
  "createdAt": ISODate("2024-01-15T10:30:00Z")
}
```

#### 3. Fields (= Columns)
```javascript
"name"             // String field
"rating"           // Number field
"createdAt"        // Date field
"medications": []  // Array field
"address": {...}   // Object/nested field
```

#### 4. Data Types
```javascript
String         → "Hello"
Number         → 42, 3.14
Boolean        → true, false
Date           → ISODate("2024-01-15")
Array          → [1, 2, 3], ["a", "b"]
Object         → { street: "Main St", city: "NYC" }
ObjectId       → Reference to another document
Null           → null
Binary         → File/image data
```

### MongoDB Operations (CRUD)

#### CREATE — Add new documents
```javascript
// Method 1: Create one
User.create({
  name: "Raj Patel",
  email: "raj@gmail.com",
  phone: "9876543210"
})
// Returns: { _id: "...", name: "Raj Patel", ... }

// Method 2: Create many
User.insertMany([
  { name: "User 1", email: "user1@gmail.com" },
  { name: "User 2", email: "user2@gmail.com" }
])
```

#### READ — Get documents
```javascript
// Get ALL documents
User.find()
// Returns: [{ _id: 1, name: "Raj", ... }, { _id: 2, name: "Priya", ... }]

// Get ONE document by ID
User.findById("63f7a1b2c3d4e5f6g7h8i9")
// Returns: { _id: "63f7a1b2c3d4e5f6g7h8i9", name: "Raj", ... }

// Get ONE by condition
User.findOne({ email: "raj@gmail.com" })
// Returns: First matching document

// Find with FILTER
User.find({ role: "doctor", city: "Mumbai" })
// Returns: All doctors in Mumbai

// SORT results
User.find().sort({ createdAt: -1 })  // Newest first
// or
User.find().sort({ createdAt: 1 })   // Oldest first

// LIMIT results
User.find().limit(10)  // Get first 10
// SKIP results
User.find().skip(20).limit(10)  // Get items 21-30 (for pagination)
```

#### UPDATE — Modify documents
```javascript
// Update one document
User.findByIdAndUpdate(
  id,
  { name: "New Name", phone: "9111111111" },
  { new: true }  // Return updated document
)

// Update specific fields
User.updateOne(
  { email: "raj@gmail.com" },
  { $set: { phone: "9999999999" } }
)

// Add item to array
User.updateOne(
  { _id: id },
  { $push: { warnings: { message: "...", issuedAt: new Date() } } }
)

// Remove item from array
User.updateOne(
  { _id: id },
  { $pull: { refreshTokens: { token: "xyz" } } }
)
```

#### DELETE — Remove documents
```javascript
// Delete one
User.findByIdAndDelete(id)

// Delete many
User.deleteMany({ role: "admin" })  // Delete all admins
```

### Why MongoDB for VCMS?

The AI analysis result is complex JSON:
```javascript
{
  "medications": [
    {
      "name": "Aspirin",
      "dosage": "500mg",
      "frequency": "twice daily",
      "duration": "7 days",
      "sideEffects": ["nausea", "upset stomach"]
    }
  ],
  "diagnosis": "High fever",
  "warnings": ["Avoid alcohol"],
  "recommendations": "Rest and hydration"
}
```

MongoDB stores this **exactly as-is** with no conversion. SQL would need 3+ tables!

### Very Important: Mongoose

**Mongoose** is a Node.js library that connects JavaScript to MongoDB.

```javascript
// Without Mongoose (raw MongoDB)
const client = new MongoClient(url);
const db = client.db("vcms");
const users = db.collection("users");
users.insertOne({ name: "Raj" });

// With Mongoose (much easier!)
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true }
});

const User = mongoose.model("User", userSchema);
User.create({ name: "Raj", email: "raj@gmail.com", password: "hashed" });
```

### Common Viva Questions on MongoDB

**Q: What is the difference between SQL and MongoDB?**  
A: SQL uses fixed-schema tables. MongoDB uses flexible JSON documents. MongoDB is better for rapidly changing data structures.

**Q: What is an Index?**  
A: An index speeds up queries. Without index, MongoDB scans every document. With index, it finds data in milliseconds. We use indices on frequently searched fields (email, userId, date).

**Q: What is ObjectId?**  
A: MongoDB's unique ID for each document. Auto-generated, 12 bytes, includes timestamp. Example: `63f7a1b2c3d4e5f6g7h8i9`

**Q: What is a schema in Mongoose?**  
A: Blueprint defining what fields a document should have and their types. Ensures data consistency.

**Q: How do you prevent duplicate emails?**  
A: Use `unique: true` on the email field in schema. MongoDB ensures no two documents have the same email.

---

## PART 3 — EXPRESS (Backend Framework)

### What is Express?
Express is Node.js framework that makes creating a server **extremely** easy.

Without Express:
```javascript
// Raw Node.js - very verbose!
const http = require('http');
const server = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/api/doctors') {
    res.writeHead(200, {'Content-Type': 'application/json'});
    res.end(JSON.stringify([...]));
  } else if (req.method === 'POST' && req.url === '/api/users') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      const user = JSON.parse(body);
      // ... handle user creation
    });
  }
});
server.listen(5000);
```

With Express:
```javascript
const express = require('express');
const app = express();

app.get('/api/doctors', (req, res) => {
  res.json([...]); // Auto JSON!
});

app.post('/api/users', (req, res) => {
  const user = req.body; // Auto parsing!
  // ... handle user
});

app.listen(5000);
```

Much cleaner! 🎉

### Core Concepts

#### 1. Routes
A route = path + method of accessing backend

```javascript
app.get('/api/users', getUsers)           // GET /api/users
app.post('/api/users', createUser)        // POST /api/users
app.put('/api/users/:id', updateUser)     // PUT /api/users/123
app.delete('/api/users/:id', deleteUser)  // DELETE /api/users/123
app.patch('/api/users/:id', partialUpdate) // Update some fields

// URL Parameters (colon :)
app.get('/api/users/:id', getUserById)
// req.params.id = "123" when accessed as /api/users/123

// Query Parameters (after ?)
app.get('/api/doctors', getDoctors)
// req.query.city = "Mumbai" when accessed as /api/doctors?city=Mumbai
// req.query.rating = "5" when accessed as /api/doctors?rating=5
```

#### 2. Request (req) Object
Contains data sent by client
```javascript
app.post('/api/appointments', (req, res) => {
  req.body.doctorId      // From POST body { "doctorId": "123" }
  req.params.id          // From URL /api/appointments/456
  req.query.page         // From URL ?page=2
  req.headers.authorization // From headers
  req.user               // From middleware (authenticated user)
  req.method             // "POST", "GET", etc.
  req.url                // "/api/appointments?page=1"
});
```

#### 3. Response (res) Object
Used to send data back to client
```javascript
res.status(200).json({ message: "OK" })  // 200 = success
res.status(201).json(newUser)             // 201 = created
res.status(400).json({ error: "Bad request" })  // 400 = client error
res.status(401).json({ error: "Not authenticated" })  // 401 = no token
res.status(403).json({ error: "Not authorized" })     // 403 = no permission
res.status(404).json({ error: "Not found" })          // 404 = doesn't exist
res.status(500).json({ error: "Server error" })       // 500 = server crash

res.send("Hello")                         // Send text
res.json({ key: "value" })                // Send JSON
res.redirect('/login')                    // Redirect to other page
res.download('/file.pdf')                 // Send file download
res.status(201).json(user)                // Custom status + JSON
```

#### 4. Middleware
Functions that run **between** request and response

```javascript
// Middleware: Logger (runs for every request)
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next(); // ← Pass to next middleware/route
});

// Middleware: Authentication (runs before routes)
const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: "No token" });
  
  try {
    const user = jwt.verify(token, process.env.JWT_SECRET);
    req.user = user; // Attach to request
    next(); // Continue to route
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
};

// Use middleware on specific routes
app.get('/api/protected', authenticate, getProtectedData);
// authenticate runs FIRST, then getProtectedData

// Or use globally
app.use(authenticate);  // All routes below this need auth
```

#### 5. Error Handling
```javascript
app.get('/api/users/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: "Not found" });
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Global error handler (must be last!)
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message });
});
```

### HTTP Status Codes (Must Know)

```
2xx = SUCCESS
  200 OK              - Request succeeded
  201 Created         - Resource created
  204 No Content      - Success, no response body

4xx = CLIENT ERROR
  400 Bad Request     - Invalid input from user
  401 Unauthorized    - Not logged in / no token
  403 Forbidden       - Logged in but no permission
  404 Not Found       - Resource doesn't exist
  409 Conflict        - Email already exists

5xx = SERVER ERROR
  500 Server Error    - Crash in backend code
  503 Service Down    - Database offline, etc.
```

### Building a Simple API

```javascript
// server.js
const express = require('express');
const mongoose = require('mongoose');
const app = express();

app.use(express.json()); // Parse JSON bodies

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI);

// Import models & routes
const User = require('./models/User');
const appointmentRoutes = require('./routes/appointmentRoutes');

// Use routes
app.use('/api/appointments', appointmentRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: "OK", timestamp: new Date() });
});

// Error handler
app.use((err, req, res, next) => {
  res.status(500).json({ error: err.message });
});

// Start server
app.listen(5000, () => console.log('Server running on port 5000'));
```

```javascript
// routes/appointmentRoutes.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const Appointment = require('../models/Appointment');

// GET /api/appointments
router.get('/', protect, async (req, res) => {
  try {
    const appointments = await Appointment.find({ 
      patientId: req.user._id 
    }).lean();
    res.json(appointments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/appointments
router.post('/', protect, async (req, res) => {
  try {
    const { doctorId, date, time } = req.body;
    
    // Validate
    if (!doctorId || !date || !time) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    
    // Create
    const apt = await Appointment.create({
      patientId: req.user._id,
      doctorId,
      date,
      time,
      status: 'pending'
    });
    
    res.status(201).json(apt);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
```

### Key Viva Questions on Express

**Q: What is the difference between GET and POST?**  
A: GET fetches data (no body). POST submits data (with body). GET is idempotent (safe to repeat), POST creates side effects.

**Q: How does middleware work?**  
A: Middleware functions run in sequence. Each calls `next()` to pass to the next middleware. Final middleware is the route handler.

**Q: What is req.body?**  
A: Data sent in the request body (usually POST). Must use `app.use(express.json())` to parse it.

**Q: What is async/await?**  
A: Way to handle asynchronous operations (database queries, API calls). `await` pauses execution until promise resolves. Much cleaner than callbacks.

---

## PART 4 — JWT AUTHENTICATION

### The Problem: How does server know who you are?

Every time you make a request, server asks: "Who are you?"

**Option 1: Sessions (Old Way)**
- Browser logs in
- Server creates session: { sessionId: "xyz", userId: "123", email: "raj@gmail.com" }
- Server stores in memory/database
- Server sends back sessionId cookie
- Browser stores: `Cookie: sessionId=xyz`
- Next request: Browser sends `Cookie: sessionId=xyz`
- Server looks up session, knows who you are

**Problem**: Session stored on server. Server needs to maintain all sessions. Doesn't scale.

**Option 2: JWT (Modern Way)**  ⭐
- Browser logs in
- Server creates JWT token: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIxMjMifQ.abc123...`
- Server sends back token
- Browser stores in localStorage
- Next request: Browser sends `Authorization: Bearer eyJhbGci...`
- Server **verifies** the token (doesn't lookup anything!)
- Done, fast!

### How JWT Works

```
┌─────────────────────────────────────────────────────┐
│  JWT Token = Header.Payload.Signature (3 parts)     │
├─────────────────────────────────────────────────────┤
│ Header (Algorithm)                                  │
│ {"alg": "HS256", "typ": "JWT"}                       │
│                                                      │
│ Payload (Data inside token)                          │
│ {"userId": "123", "email": "raj@gmail.com",          │
│  "role": "doctor", "iat": 1679456..., ...}           │
│                                                      │
│ Signature (Proof it wasn't tampered)                 │
│ HMACSHA256(Header + Payload + SECRET_KEY)            │
└─────────────────────────────────────────────────────┘
```

When encoded:
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9
.eyJ1c2VySWQiOiIxMjMiLCJyb2xlIjoiZG9jdG9yIn0
.u6dw4O2pxX8ZJLiGZ9vL8KxO9vX8Z9...
```

### How Authentication Works

```javascript
// LOGIN - Generate Token
const login = async (req, res) => {
  const { email, password } = req.body;
  
  const user = await User.findOne({ email });
  if (!user) return res.status(401).json({ error: "User not found" });
  
  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) return res.status(401).json({ error: "Wrong password" });
  
  // ✅ CREATE TOKEN
  const token = jwt.sign(
    { userId: user._id, email: user.email, role: user.role },  // PAYLOAD
    process.env.JWT_SECRET,                                     // SECRET
    { expiresIn: '1h' }                                          // OPTIONS
  );
  
  res.json({
    token,  // Send to frontend
    user: { name: user.name, role: user.role }
  });
};
```

```javascript
// PROTECT ROUTE - Verify Token
const protect = (req, res, next) => {
  try {
    // Extract token from header: "Bearer eyJhbGci..."
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: "No token" });
    
    // ✅ VERIFY TOKEN
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // If signature is wrong, this throws error!
    
    req.user = decoded;  // Attach user data to request
    next();
  } catch (err) {
    res.status(401).json({ error: "Invalid token" });
  }
};
```

```javascript
// USE MIDDLEWARE
app.get('/api/protected', protect, (req, res) => {
  // Only runs if token is valid!
  res.json({
    message: "You are authenticated",
    userId: req.user.userId,
    role: req.user.role
  });
});
```

### Frontend Side (React)

```javascript
// After login, save token
localStorage.setItem('token', response.data.token);

// Send token with every request
const token = localStorage.getItem('token');
axios.get('/api/appointments', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

// On 401 response, redirect to login
axios.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
```

### Password Security - Bcrypt

**NEVER store plain passwords!**

```javascript
const bcrypt = require('bcryptjs');

// HASHING (during registration)
const salt = await bcrypt.genSalt(10);  // Add random "salt"
const hashedPassword = await bcrypt.hash(password, salt);
// Store hashedPassword in database!

// VERIFICATION (during login)
const isMatch = await bcrypt.compare(password, user.password);
// Returns true/false, doesn't expose actual password
```

If database is hacked:
- Attacker sees: `$2a$10$x5Z8qK9pL2M3nO4pQ5rS...` (hashed)
- Attacker cannot reverse-engineer actual password
- Super safe!

### JWT Viva Questions

**Q: What is JWT?**  
A: JSON Web Token. A token issued after login that authenticates user without needing server to store sessions. Token contains encrypted user data.

**Q: Where should JWT be stored?**  
A: Frontend localStorage. Sent in every request header as `Authorization: Bearer {token}`

**Q: What happens if token expires?**  
A: Server returns 401. Frontend catches this, redirects to login, user logs in again to get new token.

**Q: Is JWT secure?**  
A: JWT payload is encoded, not encrypted. Anyone can read payload. That's why we never put passwords in JWT. The signature proves server created it.

**Q: What is the lifetime of a JWT?**  
A: Usually 15 minutes to 1 hour. Short expiry = more secure but worse UX. Use refresh tokens for long sessions.

---

## PART 5 — REACT (Frontend)

### What is React?
React is JavaScript library for building interactive user interfaces with **reusable components**.

**Component** = A piece of UI (button, form, card, entire page)

Without React:
```html
<!-- index.html -->
<html>
  <body>
    <h1>Welcome</h1>
    <button onclick="handleClick()">Click me</button>
    
    <script>
      function handleClick() {
        document.querySelector('h1').innerText = "Button clicked!";
      }
    </script>
  </body>
</html>
```

Messy! DOM manipulation directly. Hard to manage complex UIs.

With React:
```jsx
function App() {
  const [clicked, setClicked] = useState(false);
  
  return (
    <>
      <h1>{clicked ? "Button clicked!" : "Welcome"}</h1>
      <button onClick={() => setClicked(true)}>Click me</button>
    </>
  );
}

export default App;
```

Clean! Declarative. Just describe what UI should look like.

### Core Concepts

#### 1. Components
Functions that return JSX (looks like HTML but is JavaScript)

```jsx
function Navbar() {
  return (
    <nav className="navbar">
      <h1>VCMS</h1>
      <ul>
        <li>Home</li>
        <li>Doctors</li>
        <li>Profile</li>
      </ul>
    </nav>
  );
}

// Use it
<Navbar />
// Output:
// <nav class="navbar">
//   <h1>VCMS</h1>
//   ...
// </nav>
```

#### 2. Props (Properties)
Data passed from parent to child component

```jsx
// Parent
function App() {
  return <DoctorCard name="Dr. Raj" rating={4.5} />;
}

// Child
function DoctorCard({ name, rating }) {
  return (
    <div className="card">
      <h2>{name}</h2>
      <p>⭐ {rating}</p>
    </div>
  );
}

// Output:
// <div class="card">
//   <h2>Dr. Raj</h2>
//   <p>⭐ 4.5</p>
// </div>
```

#### 3. useState - Add Interactivity
State = Component's memory. When state changes, component re-renders.

```jsx
import { useState } from 'react';

function Counter() {
  const [count, setCount] = useState(0);
  // count = current value
  // setCount = function to update it
  
  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={() => setCount(count + 1)}>
        Increment
      </button>
    </div>
  );
}

// First render: count = 0
// User clicks button: setCount(1) → state changes → re-render with count = 1
// User clicks again: setCount(2) → count = 2
// And so on...
```

#### 4. useEffect - Run Code After Render
Fetch data from API, set up timers, subscriptions, etc.

```jsx
import { useState, useEffect } from 'react';

function DoctorsList() {
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    // This code runs AFTER component renders
    const fetchDoctors = async () => {
      const res = await axios.get('/api/public/doctors');
      setDoctors(res.data);
      setLoading(false);
    };
    
    fetchDoctors();
  }, []); // Empty dependency array = run once on mount
  
  if (loading) return <p>Loading...</p>;
  
  return (
    <ul>
      {doctors.map(doc => (
        <li key={doc._id}>{doc.name}</li>
      ))}
    </ul>
  );
}

// Dependency array controls when effect runs:
// [] = once on mount
// [dependency] = whenever dependency changes
// No array = every render (usually a mistake!)
```

#### 5. Conditional Rendering
Show different UI based on conditions

```jsx
function Dashboard({ isLoggedIn, user }) {
  if (isLoggedIn && user.role === 'doctor') {
    return (
      <div>
        <h1>Doctor Dashboard</h1>
        <p>Hello, {user.name}</p>
      </div>
    );
  } else if (isLoggedIn && user.role === 'patient') {
    return <h1>Patient Dashboard</h1>;
  } else {
    return <h1>Please login</h1>;
  }
}

// Shorter way with ternary:
<div>
  {isLoggedIn ? (
    <h1>Welcome back!</h1>
  ) : (
    <h1>Please login</h1>
  )}
</div>

// Or with &&:
{isLoggedIn && <button>Logout</button>}
```

#### 6. Lists - .map()
Render list of items

```jsx
function TodoList({ todos }) {
  return (
    <ul>
      {todos.map(todo => (
        <li key={todo.id}>{todo.text}</li>
        // key = unique identifier for each item
        // MUST have key when rendering lists!
      ))}
    </ul>
  );
}

// Example data:
const todos = [
  { id: 1, text: "Learn React" },
  { id: 2, text: "Build MERN app" },
  { id: 3, text: "Deploy" }
];

// Renders:
// <ul>
//   <li>Learn React</li>
//   <li>Build MERN app</li>
//   <li>Deploy</li>
// </ul>
```

#### 7. Forms - Controlled Components
Input values controlled by state

```jsx
function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // "Controlled" = form data is in state, not DOM
  
  const handleSubmit = async (e) => {
    e.preventDefault(); // Prevent page reload
    
    const res = await axios.post('/api/auth/login', {
      email,
      password
    });
    
    localStorage.setItem('token', res.data.token);
  };
  
  return (
    <form onSubmit={handleSubmit}>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
      />
      <button type="submit">Login</button>
    </form>
  );
}
```

#### 8. Context - Global State
Share data without passing props through every component

```jsx
// Create context
const AuthContext = React.createContext();

// Provider component (at top of app)
function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  
  return (
    <AuthContext.Provider value={{ user, setUser, token, setToken }}>
      {children}
    </AuthContext.Provider>
  );
}

// In any child component, access global state:
function UserProfile() {
  const { user } = useContext(AuthContext);
  
  return <h1>Hello, {user.name}</h1>;
}

// Wrap app with provider:
<AuthProvider>
  <App />
</AuthProvider>
```

#### 9. React Router - Navigation Between Pages
```jsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/doctor/:id" element={<DoctorDetailPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}

// Link to pages (no page reload!)
<Link to="/doctors">Browse Doctors</Link>

// Get URL parameters
function DoctorDetailPage() {
  const { id } = useParams();  // id from /doctor/:id
  // Fetch doctor with this id
}

// Navigate programmatically
function LoginPage() {
  const navigate = useNavigate();
  
  const handleLogin = async () => {
    await login(email, password);
    navigate('/dashboard');  // Go to dashboard after login
  };
}
```

#### 10. Axios - Make API Calls
```jsx
import axios from 'axios';

// Create instance with base URL
const api = axios.create({
  baseURL: 'http://localhost:5000'
});

// Add token to every request
api.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// In component:
useEffect(() => {
  api.get('/api/appointments')
    .then(res => setAppointments(res.data))
    .catch(err => setError(err.message));
}, []);

// Or with async/await:
const fetchAppointments = async () => {
  try {
    const res = await api.get('/api/appointments');
    setAppointments(res.data);
  } catch (err) {
    setError(err.message);
  }
};
```

### Complete Example: Doctor Booking Page

```jsx
import { useState, useEffect } from 'react';
import axios from 'axios';

function DoctorBooking() {
  const [doctors, setDoctors] = useState([]);
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Fetch doctors on mount
  useEffect(() => {
    const fetchDoctors = async () => {
      try {
        const res = await axios.get('/api/public/doctors');
        setDoctors(res.data);
      } catch (err) {
        setError('Failed to load doctors');
      } finally {
        setLoading(false);
      }
    };
    
    fetchDoctors();
  }, []);
  
  // Book appointment
  const handleBook = async () => {
    if (!selectedDoctor || !selectedDate || !selectedTime) {
      setError('Please select all fields');
      return;
    }
    
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post('/api/appointments', {
        doctorId: selectedDoctor._id,
        date: selectedDate,
        time: selectedTime
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      alert('Appointment booked successfully!');
    } catch (err) {
      setError(err.response?.data?.error || 'Booking failed');
    }
  };
  
  if (loading) return <p>Loading doctors...</p>;
  if (error) return <p style={{color: 'red'}}>{error}</p>;
  
  return (
    <div>
      <h1>Book Appointment</h1>
      
      <div>
        <label>Select Doctor:</label>
        <select onChange={e => setSelectedDoctor(JSON.parse(e.target.value))}>
          <option>-- Choose --</option>
          {doctors.map(doc => (
            <option key={doc._id} value={JSON.stringify(doc)}>
              {doc.name} ({doc.specialization})
            </option>
          ))}
        </select>
      </div>
      
      <div>
        <label>Date:</label>
        <input
          type="date"
          value={selectedDate}
          onChange={e => setSelectedDate(e.target.value)}
        />
      </div>
      
      <div>
        <label>Time:</label>
        <input
          type="time"
          value={selectedTime}
          onChange={e => setSelectedTime(e.target.value)}
        />
      </div>
      
      <button onClick={handleBook}>Book Now</button>
    </div>
  );
}

export default DoctorBooking;
```

### React Viva Questions

**Q: What is React?**  
A: React is a frontend JavaScript library for building interactive UIs using reusable components. It uses state and props to manage data and rendering.

**Q: What is JSX?**  
A: JSX looks like HTML but is actually JavaScript. Babel compiler converts it to `React.createElement()` calls.

**Q: What is the Virtual DOM?**  
A: React keeps an in-memory copy of the DOM. When state changes, it updates virtual DOM, compares with actual DOM, and updates only what changed. Very efficient!

**Q: What is the difference between state and props?**  
A: State is component's internal data (can change). Props are data passed from parent (read-only). State changes trigger re-render. Props changes trigger re-render.

**Q: When should you use useEffect?**  
A: For side effects: fetching data, setting up subscriptions, timers, direct DOM manipulation. Must be after render.

**Q: Is it safe to put API calls in useEffect without dependency array?**  
A: NO! Infinite loop! API call runs → state updates → re-render → API call again. Always use `[]` to run once.

---

## PART 6 — PUTTING IT ALL TOGETHER

### Request Journey
```
User clicks "Book Appointment"
       ↓
React component calls: axios.post('/api/appointments', {...})
       ↓
Frontend:
- Adds JWT token to header
- Serializes data to JSON
- Sends HTTP POST request to localhost:5000
       ↓
Backend:
- Express receives request
- protect middleware runs:
  - Extract token from header
  - Verify JWT signature
  - Extract userId, role
  - If invalid → return 401
- Route handler (createAppointment) runs:
  - Validate input (date, doctorId, etc.)
  - Check doctor exists
  - Check slot available
  - Create appointment in database
  - Create notification for doctor
  - Emit Socket event to doctor
  - Return 201 with appointment data
       ↓
Frontend:
- Receives 201 response
- Parse JSON: { _id: "...", status: "pending", ... }
- Update state (setAppointments)
- Component re-renders "Appointment booked!"
- Show toast notification
       ↓
Doctor:
- Real-time Socket event
- Receives notification: "New appointment from Raj"
- Refreshes appointments list
- Decides to accept/reject
```

### Architecture Summary
```
┌─────────────────────┐
│  React App (3000)   │
│  - Pages            │
│  - Components       │
│  - State/Context    │
│  - API Service      │
└──────────┬──────────┘
           │ HTTP/REST
           │ Axios
           ↓
┌─────────────────────┐
│ Express (5000)      │
│ - Routes            │
│ - Middleware        │
│ - Controllers       │
│ - Authentication    │
└──────────┬──────────┘
           │ Mongoose
           │ Queries
           ↓
┌─────────────────────┐
│ MongoDB             │
│ - users             │
│ - appointments      │
│ - prescriptions     │
│ - ... (7 more)      │
└─────────────────────┘
```

---

## PART 7 — COMMON MISTAKES & HOW TO AVOID

### Frontend Mistakes

**❌ Mistake 1: No error handling on API calls**
```javascript
// Bad
const [doctors, setDoctors] = useState([]);

useEffect(() => {
  axios.get('/api/doctors')
    .then(res => setDoctors(res.data));
}, []);
// If API fails, user sees blank screen. No feedback!
```

**✅ Fix: Add try/catch and error state**
```javascript
const [doctors, setDoctors] = useState([]);
const [error, setError] = useState(null);

useEffect(() => {
  const fetch = async () => {
    try {
      const res = await axios.get('/api/doctors');
      setDoctors(res.data);
    } catch (err) {
      setError(err.message);
    }
  };
  fetch();
}, []);

return error ? <p>{error}</p> : <DoctorsList doctors={doctors} />;
```

**❌ Mistake 2: Forgot missing dependency in useEffect**
```javascript
// Bad - infinite loop!
useEffect(() => {
  fetchDoctors();  // Called every render!
});  // No dependency array
```

**✅ Fix: Add empty array**
```javascript
useEffect(() => {
  fetchDoctors();  // Called once on mount
}, []);  // Empty array
```

**❌ Mistake 3: Storing JWT in localStorage**
```javascript
// Bad - localStorage accessible to ANY JavaScript!
localStorage.setItem('token', token);
// XSS attack can steal token
```

**✅ Fix: Use HttpOnly cookies**
```javascript
// Backend sets cookie
res.cookie('token', token, {
  httpOnly: true,    // JavaScript can't access
  secure: true,      // HTTPS only
  sameSite: 'strict' // CSRF protection
});

// Frontend doesn't need to do anything
// Browser automatically sends cookie
```

**❌ Mistake 4: Not checking authentication before showing page**
```javascript
// Bad - sensitive data shown to everyone
function Dashboard() {
  return <h1>Patient Dashboard</h1>;
}

// Any logged-out user can access /dashboard
```

**✅ Fix: Protected route**
```javascript
function ProtectedRoute({ children }) {
  const { token } = useContext(AuthContext);
  
  if (!token) {
    return <Navigate to="/login" />;
  }
  
  return children;
}

// Usage
<Route path="/dashboard" element={
  <ProtectedRoute>
    <Dashboard />
  </ProtectedRoute>
} />
```

### Backend Mistakes

**❌ Mistake 1: No input validation**
```javascript
// Bad
app.post('/api/users', async (req, res) => {
  const user = await User.create(req.body);
  res.json(user);
});
// User could send empty name, invalid email, etc.
```

**✅ Fix: Validate before saving**
```javascript
app.post('/api/users', async (req, res) => {
  const { name, email, password } = req.body;
  
  // Validate
  if (!name || name.length < 2) {
    return res.status(400).json({ error: "Name too short" });
  }
  if (!email.includes('@')) {
    return res.status(400).json({ error: "Invalid email" });
  }
  if (!password || password.length < 8) {
    return res.status(400).json({ error: "Password too short" });
  }
  
  const user = await User.create({ name, email, password });
  res.json(user);
});

// Or use validation library
const { body, validationResult } = require('express-validator');

app.post('/api/users',
  [
    body('name').notEmpty().isLength({ min: 2 }),
    body('email').isEmail(),
    body('password').isLength({ min: 8 })
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    // ... create user
  }
);
```

**❌ Mistake 2: Storing passwords in plain text**
```javascript
// NEVER DO THIS!
const user = await User.create({
  email: "raj@gmail.com",
  password: "password123"  // Visible in database!
});
```

**✅ Fix: Hash with bcrypt**
```javascript
const bcrypt = require('bcryptjs');

const salt = await bcrypt.genSalt(10);
const hashedPassword = await bcrypt.hash(password, salt);

const user = await User.create({
  email,
  password: hashedPassword  // Hashed, safe!
});
```

**❌ Mistake 3: Wrong HTTP status codes**
```javascript
// Bad
app.get('/api/users/:id', async (req, res) => {
  const user = await User.findById(req.params.id);
  
  if (!user) {
    res.send("User not found");  // Should be 404, not 200!
  }
  
  res.send(user);  // Should be 200, not default!
});
```

**✅ Fix: Use correct status codes**
```javascript
app.get('/api/users/:id', async (req, res) => {
  const user = await User.findById(req.params.id);
  
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }
  
  res.status(200).json(user);  // Or just res.json(user)
});
```

**❌ Mistake 4: No try/catch in async routes**
```javascript
// Bad - if DB crashes, entire server crashes!
app.get('/api/users', async (req, res) => {
  const users = await User.find();
  res.json(users);
});
```

**✅ Fix: Always use try/catch**
```javascript
app.get('/api/users', async (req, res) => {
  try {
    const users = await User.find();
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});
```

**❌ Mistake 5: Exposing sensitive data**
```javascript
// Bad
const user = await User.findById(req.params.id);
res.json(user);  // Returns password hash!
```

**✅ Fix: Use .select to exclude fields**
```javascript
const user = await User.findById(req.params.id).select('-password');
res.json(user);  // Password not included!
```

---

## PART 8 — DEPLOYMENT NOTES

### Local Development
```bash
# Terminal 1 - MongoDB
mongod

# Terminal 2 - Backend
cd server
npm install
npm run dev

# Terminal 3 - Frontend
cd ..
npm install
npm run dev
```

### Environment Variables (.env)
```
MONGO_URI=mongodb://localhost:27017/vcms
JWT_SECRET=your_super_secret_key_here_change_in_production
PORT=5000
NODE_ENV=development
OPENAI_API_KEY=sk-...
FRONTEND_URL=http://localhost:3000
```

### Before Submitting College Project
- [ ] Remove all console.log statements
- [ ] Remove all console.error statements
- [ ] Test with real data
- [ ] Test error cases (wrong password, deletion, etc.)
- [ ] Check all input validation works
- [ ] Test on different browsers
- [ ] Document code with comments
- [ ] Have 3-5 sample users ready
- [ ] Document database structure
- [ ] Document all API endpoints

---

## 🎯 FINAL VIVA CHECKLIST

### Conceptual Questions (Will definitely ask)
- [ ] What is MERN stack?
- [ ] How does authentication work?
- [ ] What is JWT and how is it different from sessions?
- [ ] How do frontend and backend communicate?
- [ ] What is a database and why use MongoDB?
- [ ] What is middleware?
- [ ] Explain this request: POST /api/appointments with data

### Code Questions (Likely)
- [ ] Show me a simple API endpoint. How does it work?
- [ ] Where in code do you connect to MongoDB?
- [ ] Show me how you verify JWT token. What happens if token is invalid?
- [ ] How do you prevent SQL injection?
- [ ] How do you hash passwords?
- [ ] How do you handle errors?
- [ ] Why use async/await instead of callbacks?

### Architecture Questions (Might ask)
- [ ] Draw the complete system architecture
- [ ] What happens when user clicks "Book Appointment"?
- [ ] How does real-time notification work?
- [ ] How do you scale this app to 1 million users?
- [ ] Where would bottlenecks be?

### Best Practices (Show you studied)
- [ ] How do you prevent XSS attacks?
- [ ] How do you prevent CSRF attacks?
- [ ] How do you manage secrets/API keys?
- [ ] What's the difference between 401 and 403?
- [ ] When to use GET vs POST?
- [ ] Is storing password in JWT safe?

---

## 🎊 YOU'RE READY!

You now understand:
- ✅ MongoDB collections, documents, queries
- ✅ Express routes, middleware, controllers
- ✅ React components, hooks, state management
- ✅ Node.js async operations
- ✅ JWT authentication & authorization
- ✅ How complete request works
- ✅ Common security practices
- ✅ HTTP status codes

**Go crush your viva!** 💪

