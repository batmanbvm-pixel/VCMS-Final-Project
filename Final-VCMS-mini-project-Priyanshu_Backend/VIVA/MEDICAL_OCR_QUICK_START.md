# Medical OCR Quick Start Guide

## 🚀 Quick Start

### 1. Start the Backend Server

```bash
cd server
npm install
npm start
```

Server will run on `http://localhost:5000`

### 2. Start the Frontend

```bash
npm install
npm run dev
```

Frontend will run on `http://localhost:5173`

### 3. Access the Medical Document Analyzer

Navigate to: `http://localhost:5173/medical-document-analyzer`

Or import and use the component:
```tsx
import MedicalDocumentAnalyzer from '@/pages/MedicalDocumentAnalyzer';
```

---

## 📖 Usage Examples

### Example 1: Analyze a Prescription (Frontend)

```typescript
import geminiService from '@/services/geminiService';

const file = document.getElementById('fileInput').files[0];
const result = await geminiService.analyzeMedicalDocument(file);

console.log(result);
// {
//   status: "success",
//   document_type: "prescription",
//   medicines: [...],
//   ...
// }
```

### Example 2: API Call with Fetch

```javascript
const formData = new FormData();
formData.append('file', fileInput.files[0]);

const response = await fetch('http://localhost:5000/api/ai/analyze-medical-document', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${yourJwtToken}`
  },
  body: formData
});

const result = await response.json();
console.log(result);
```

### Example 3: cURL Command

```bash
# Login first to get token
TOKEN=$(curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"patient@test.com","password":"password123"}' \
  | jq -r '.token')

# Analyze document
curl -X POST http://localhost:5000/api/ai/analyze-medical-document \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@prescription.jpg"
```

### Example 4: Python Script

```python
import requests

# Login
login_response = requests.post(
    'http://localhost:5000/api/auth/login',
    json={'email': 'patient@test.com', 'password': 'password123'}
)
token = login_response.json()['token']

# Upload and analyze
files = {'file': open('prescription.jpg', 'rb')}
headers = {'Authorization': f'Bearer {token}'}

response = requests.post(
    'http://localhost:5000/api/ai/analyze-medical-document',
    files=files,
    headers=headers
)

result = response.json()
print(result)
```

---

## 🧪 Test Scenarios

### Scenario 1: Valid Prescription
**Upload**: Image of a doctor's prescription  
**Expected**: `status: "success"`, `document_type: "prescription"`, populated `medicines` array

### Scenario 2: Lab Report PDF
**Upload**: PDF of blood test results  
**Expected**: `status: "success"`, `document_type: "lab_report"`, populated `lab_results` array

### Scenario 3: Non-Medical Document
**Upload**: Receipt, ID card, or food menu  
**Expected**: `status: "non_medical"`, appropriate error message

### Scenario 4: Blurry/Unreadable Image
**Upload**: Very dark or blurry medical document  
**Expected**: `status: "ocr_failed"`, guidance to upload clearer image

### Scenario 5: Password-Protected PDF
**Upload**: Encrypted PDF  
**Expected**: `status: "ocr_failed"`, message about password protection

---

## 📊 Sample Response Structures

### Success - Prescription
```json
{
  "status": "success",
  "input_type": "image",
  "document_type": "prescription",
  "overview": {
    "doctor_name": "Dr. Smith",
    "diagnosis": "🩺 You have a bacterial throat infection"
  },
  "medicines": [
    {
      "name": "Amoxicillin",
      "dosage": "500mg",
      "frequency": "Three times a day",
      "timing": ["🌅 Morning — after breakfast", "☀️ Afternoon — after lunch", "🌙 Night — after dinner"],
      "side_effects": [
        "😮 May cause mild nausea",
        "😵 Can cause dizziness",
        "🚽 May cause loose stools"
      ]
    }
  ],
  "summary": {
    "overview_points": [
      "🩺 Bacterial throat infection diagnosed",
      "💊 Amoxicillin 500mg — 3 times daily after meals",
      "⚠️ Complete full 7-day course",
      "🥗 Eat light, avoid spicy food",
      "📅 Follow up after 7 days"
    ]
  }
}
```

### Success - Lab Report
```json
{
  "status": "success",
  "input_type": "pdf",
  "document_type": "lab_report",
  "lab_results": [
    {
      "test_name": "Fasting Blood Glucose",
      "your_value": "126 mg/dL",
      "normal_range": "70–100 mg/dL",
      "status": "HIGH",
      "status_emoji": "🔴",
      "what_it_means": [
        "📊 Your blood sugar is higher than normal",
        "⚠️ This may indicate pre-diabetes"
      ],
      "what_to_do": [
        "🥗 Cut down on sugar and carbs",
        "🏃 Start daily 30-minute walk",
        "🔄 Repeat test in 3 months"
      ]
    }
  ]
}
```

### Error - Non-Medical
```json
{
  "status": "non_medical",
  "message": "⚠️ This does not look like a medical document. Please upload a valid prescription or lab report."
}
```

### Error - OCR Failed
```json
{
  "status": "ocr_failed",
  "message": "❌ We could not read your document. Please upload a clearer photo, scan, or a non-password-protected PDF."
}
```

---

## 🎯 Integration Checklist

- [ ] Backend server running on port 5000
- [ ] Frontend configured to connect to backend
- [ ] JWT authentication working
- [ ] File upload configured (multer)
- [ ] Tesseract.js installed for OCR
- [ ] pdf-parse installed for PDF text extraction
- [ ] Google Gemini API key configured (optional, for AI analysis)
- [ ] Error handling implemented
- [ ] File cleanup after processing
- [ ] CORS configured for frontend domain

---

## ⚠️ Common Issues & Solutions

### Issue 1: "Backend not reachable"
**Solution**: Ensure backend is running on port 5000
```bash
cd server
npm start
```

### Issue 2: "Unauthorized"
**Solution**: User must be logged in, JWT token required
```javascript
// Ensure user is authenticated first
await login(email, password);
```

### Issue 3: "OCR Failed" for clear images
**Solution**: Check Tesseract.js installation
```bash
cd server
npm install tesseract.js
```

### Issue 4: PDF text extraction returns empty
**Solution**: The PDF might be scanned/image-based. Convert to image first:
- Open PDF
- Take screenshot or export as JPG
- Upload the image instead

### Issue 5: AI analysis not detailed enough
**Solution**: Ensure Google Gemini API key is configured
```bash
# In server/.env
GEMINI_API_KEY=AIza...
```

---

## 📝 Tips for Best Results

### For Patients/Users
1. **Take Clear Photos**
   - Good lighting
   - Steady hand (no blur)
   - Full document visible
   - Avoid shadows

2. **Use High Resolution**
   - At least 1920x1080 recommended
   - Avoid excessive compression

3. **Correct Orientation**
   - Document should be right-side-up
   - Text should be horizontal

4. **File Format**
   - PDF with selectable text is best
   - JPG/PNG for photos
   - Avoid HEIC (convert to JPG first)

### For Developers
1. **Add Loading States**: OCR can take 3-8 seconds
2. **Show Progress**: Display "Extracting text..." and "Analyzing..." states
3. **Handle Errors Gracefully**: Show user-friendly messages
4. **Validate Before Upload**: Check file size and type on frontend
5. **Implement Retry Logic**: Network issues can occur
6. **Cache Results**: Store analysis results to avoid re-processing

---

## 🔗 Related Endpoints

### Other AI endpoints in the system:
- `POST /api/ai/summarize` - Summarize prescriptions
- `POST /api/ai/analyze-report` - Analyze text reports
- `POST /api/ai/extract-text` - Extract text only (no analysis)

### Medical History endpoints:
- `POST /api/medical-history` - Save medical history record
- `POST /api/medical-history/upload-report` - Upload report file
- `GET /api/medical-history/patient/:id` - Get patient history

---

## 🚀 Next Steps

After implementing the basic functionality, consider:

1. **Add Batch Processing**: Process multiple documents at once
2. **Implement Caching**: Store frequently accessed analyses
3. **Add Export Options**: PDF, Excel, CSV exports
4. **Create Mobile App**: React Native or Flutter implementation
5. **Add Voice Output**: Text-to-speech for accessibility
6. **Multi-language Support**: Hindi, Spanish, etc.
7. **Integration with EHR**: HL7 FHIR standards
8. **Blockchain Storage**: Immutable medical records

---

## 📞 Need Help?

1. Check the main documentation: `MEDICAL_OCR_DOCUMENTATION.md`
2. Review server logs: `server/logs/`
3. Test with sample files in `server/test-files/` (if available)
4. Check network tab in browser DevTools
5. Verify backend console for error messages

---

**Built with ❤️ for VCMS - Virtual Clinic Management System**
