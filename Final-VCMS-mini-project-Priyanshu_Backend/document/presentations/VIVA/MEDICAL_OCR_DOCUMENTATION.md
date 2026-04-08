# Medical Document OCR Reader & Analyzer

## 📋 Overview

A comprehensive medical document OCR reader and analyzer built into the VCMS health app. This system reads, validates, analyzes, and extracts structured data from medical documents including prescriptions, lab reports, discharge summaries, and radiology reports.

## 🚀 Features

### ✅ What It Does
- **Reads Multiple Formats**: JPG, PNG, WEBP, HEIC images and PDF documents
- **Intelligent OCR**: Uses Tesseract.js for image text extraction and pdf-parse for PDF text extraction
- **Medical Validation**: Automatically detects if a document is medical or non-medical
- **Document Type Detection**: Identifies prescriptions, lab reports, discharge summaries, or radiology reports
- **AI-Powered Analysis**: Uses Google Gemini API (when available) for comprehensive analysis
- **Rule-Based Fallback**: Provides analysis even without AI using pattern matching
- **Patient-Friendly Output**: Returns structured JSON with emojis and plain language explanations

### 📊 Supported Document Types
1. **Prescription** - Medicine names, dosages, frequencies, side effects
2. **Lab Report** - Test results with interpretations and recommendations
3. **Discharge Summary** - Hospital discharge information with medications
4. **Radiology Report** - X-ray, MRI, CT scan, ultrasound findings

## 🔧 Technical Implementation

### Backend API Endpoint

**Endpoint**: `POST /api/ai/analyze-medical-document`

**Authentication**: Requires JWT token (protect middleware)

**Request**:
```http
POST /api/ai/analyze-medical-document
Authorization: Bearer <JWT_TOKEN>
Content-Type: multipart/form-data

file: <IMAGE_OR_PDF_FILE>
```

**File Requirements**:
- **Allowed Types**: `image/jpeg`, `image/png`, `image/jpg`, `application/pdf`
- **Max Size**: 10 MB
- **Quality**: Clear, readable text for best OCR results

### Response JSON Structure

The API returns ONE of these response types:

#### 1. OCR Failed Response
```json
{
  "status": "ocr_failed",
  "message": "❌ We could not read your document. Please upload a clearer photo, scan, or a non-password-protected PDF."
}
```

#### 2. Non-Medical Document Response
```json
{
  "status": "non_medical",
  "message": "⚠️ This does not look like a medical document. Please upload a valid prescription or lab report."
}
```

#### 3. Success Response
```json
{
  "status": "success",
  "input_type": "image" | "pdf",
  "document_type": "prescription" | "lab_report" | "discharge_summary" | "radiology_report",
  
  "ocr_extracted_text": "Full raw text extracted from image or PDF...",
  
  "overview": {
    "hospital_or_lab": "Name or 'Not mentioned'",
    "doctor_name": "Name or 'Not mentioned'",
    "patient_name": "Name or 'Not mentioned'",
    "patient_age": "Age or 'Not mentioned'",
    "date": "Date or 'Not mentioned'",
    "diagnosis": "Simple explanation or 'Not mentioned in document'"
  },
  
  "medicines": [
    {
      "name": "Medicine name",
      "generic_name": "Generic name or 'Not available'",
      "what_it_does": "💊 Simple explanation",
      "dosage": "500mg",
      "frequency": "Twice a day",
      "timing": [
        "🌅 Morning — after breakfast",
        "🌙 Night — after dinner"
      ],
      "take_with": "💧 Take with full glass of water",
      "duration": "📆 For 7 days",
      "side_effects": [
        "😮 Side effect 1",
        "😵 Side effect 2",
        "🚽 Side effect 3",
        "🔴 Side effect 4",
        "😴 Side effect 5"
      ],
      "what_to_avoid": [
        "🍺 Avoid alcohol",
        "🍽️ Never take on empty stomach",
        "🚗 Avoid driving"
      ],
      "important_tip": "💡 Complete the full course"
    }
  ],
  
  "lab_results": [
    {
      "test_name": "Fasting Blood Glucose",
      "your_value": "126 mg/dL",
      "normal_range": "70–100 mg/dL",
      "status": "HIGH" | "LOW" | "NORMAL",
      "status_emoji": "🔴" | "🟡" | "🟢",
      "what_it_means": [
        "📊 Explanation point 1",
        "⚠️ Explanation point 2"
      ],
      "what_to_do": [
        "🥗 Action 1",
        "🏃 Action 2",
        "🔄 Action 3"
      ]
    }
  ],
  
  "radiology_findings": {
    "scan_type": "Chest X-Ray or 'Not applicable'",
    "findings": [
      "🔬 Finding 1",
      "🔬 Finding 2"
    ],
    "impression": "📋 Final conclusion",
    "what_to_do": [
      "💊 Action 1",
      "🏠 Action 2"
    ]
  },
  
  "alerts": [
    {
      "level": "CRITICAL" | "WARNING" | "INFO",
      "emoji": "🔴" | "🟡" | "ℹ️",
      "title": "Alert heading",
      "description": "What this means",
      "action": "🏥 Specific action to take"
    }
  ],
  
  "lifestyle": {
    "diet": [
      "✅ Eat: green vegetables",
      "❌ Avoid: sugary drinks"
    ],
    "exercise": [
      "🏃 30-minute walk daily"
    ],
    "hydration": [
      "💧 Drink 8-10 glasses daily"
    ],
    "sleep": [
      "😴 Get 7-8 hours sleep"
    ],
    "avoid": [
      "🚭 No smoking",
      "🍺 No alcohol"
    ]
  },
  
  "followup": {
    "next_visit": "📅 Return after 7 days",
    "repeat_tests": [
      "🔄 Repeat blood sugar after 3 months"
    ],
    "emergency_signs": [
      "🚨 Difficulty breathing — emergency",
      "🌡️ Fever above 103°F — urgent",
      "😵 Severe headache — emergency",
      "💊 Swelling after medicine — emergency",
      "😶 Extreme weakness — emergency"
    ]
  },
  
  "summary": {
    "overview_points": [
      "🩺 What document is about",
      "💊 Medicine 1 details",
      "💊 Medicine 2 details",
      "🧪 Key test result",
      "⚠️ Important warning",
      "🥗 Diet tip",
      "🏃 Exercise instruction",
      "📅 Follow-up date",
      "🚨 Emergency symptoms"
    ]
  },
  
  "disclaimer": "⚕️ This analysis is AI-generated for informational purposes only. Always consult your doctor or pharmacist before making any medical decisions."
}
```

## 💻 Frontend Integration

### Using the Service

```typescript
import geminiService from '@/services/geminiService';

// Upload and analyze a medical document
const analyzeDocument = async (file: File) => {
  try {
    const result = await geminiService.analyzeMedicalDocument(file);
    
    if (result.status === 'success') {
      // Handle successful analysis
      console.log('Document Type:', result.document_type);
      console.log('Medicines:', result.medicines);
      console.log('Lab Results:', result.lab_results);
    } else if (result.status === 'ocr_failed') {
      // Handle OCR failure
      console.error('OCR Failed:', result.message);
    } else if (result.status === 'non_medical') {
      // Handle non-medical document
      console.warn('Non-Medical:', result.message);
    }
  } catch (error) {
    console.error('Analysis failed:', error);
  }
};
```

### React Component

A complete React component is available at:
```
src/pages/MedicalDocumentAnalyzer.tsx
```

This component provides:
- File upload with drag & drop
- Real-time analysis progress
- Formatted display of all results
- Expandable sections for different data types
- JSON download functionality
- Error handling with user-friendly messages

## 🔍 How It Works

### Phase 1: Read Input
1. Accepts IMAGE (JPG, PNG, WEBP) or PDF file
2. For PDFs: Uses `pdf-parse` to extract text
3. For Images: Uses `Tesseract.js` OCR with English language model
4. Extracts ALL visible text including tables, headers, stamps

### Phase 2: Validate Readability
- Checks if extracted text has at least 20 characters
- Returns `ocr_failed` status if document is unreadable
- Handles blurry images, corrupted PDFs, password-protected files

### Phase 3: Validate Medical Content
- Scans text for medical keywords (min 3 required):
  - patient, doctor, prescription, medication, diagnosis
  - blood, glucose, test, lab, hospital, clinic
  - x-ray, scan, radiology, treatment, etc.
- Returns `non_medical` status if insufficient medical keywords found

### Phase 4: Detect Document Type
- **Prescription**: Contains "rx", "prescription", "medication", "dosage"
- **Lab Report**: Contains "lab", "test result", "reference range", "normal range"
- **Radiology Report**: Contains "x-ray", "mri", "ct scan", "ultrasound", "radiology"
- **Discharge Summary**: Contains "discharge", "admission", "admitted"

### Phase 5: Analysis
- **With Gemini API**: Uses Google Gemini for comprehensive AI analysis
- **Without Gemini API**: Falls back to rule-based pattern matching
- Extracts structured data for all fields
- Formats output with emojis and patient-friendly language

## 🎯 Use Cases

### For Patients
1. **Upload Lab Reports**: Get easy-to-understand explanations of test results
2. **Read Prescriptions**: Understand medicines, side effects, and when to take them
3. **Track Medical History**: Store and analyze all medical documents in one place
4. **Get Lifestyle Tips**: Receive personalized diet and exercise recommendations

### For Doctors
1. **Quick Review**: Fast overview of patient's medical documents
2. **Patient Education**: Share AI-generated summaries with patients
3. **Clinical Decision Support**: Get structured data from unstructured reports

### For Developers
1. **API Integration**: Easy-to-use REST API with consistent JSON response
2. **Customization**: Extend analysis rules and customize output format
3. **AI Enhancement**: Plug in any LLM (Gemini, OpenAI, Anthropic, local models)

## ⚙️ Configuration

### Environment Variables

```env
# Required only for AI-powered analysis
GEMINI_API_KEY=AIza...

# If not set, system will use rule-based analysis
```

### Dependencies

**Backend**:
```json
{
  "tesseract.js": "^4.x",
  "pdf-parse": "^1.x",
  "fetch": "native",
  "multer": "^1.x"
}
```

**Frontend**:
```json
{
  "axios": "^1.x",
  "@tanstack/react-query": "^4.x" // Optional for caching
}
```

## 🧪 Testing

### Test with Sample Documents

1. **Prescription**: Upload an image of a doctor's prescription
2. **Lab Report**: Upload a PDF of blood test results
3. **Non-Medical**: Upload a receipt to test rejection

### API Testing with cURL

```bash
# Test the endpoint
curl -X POST http://localhost:5000/api/ai/analyze-medical-document \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "file=@prescription.jpg"
```

### Expected Response Time
- **Images (OCR)**: 3-8 seconds depending on image quality
- **PDFs (text extraction)**: 1-2 seconds
- **AI Analysis (if enabled)**: +2-4 seconds

## 🔒 Security & Privacy

### Data Handling
- ✅ Files are temporarily stored for processing
- ✅ Files are deleted immediately after analysis
- ✅ No medical data is logged or stored permanently
- ✅ User authentication required (JWT)
- ✅ File size and type validation

### HIPAA Considerations
- Encrypt data in transit (HTTPS)
- Store files in secure, encrypted storage
- Implement audit logging
- Add user consent mechanisms
- Regular security audits

## 🐛 Error Handling

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `ocr_failed` | Blurry/dark image | Upload clearer photo |
| `non_medical` | Wrong document type | Upload medical document |
| `File too large` | File > 10MB | Compress or resize file |
| `Invalid file type` | Wrong format | Use JPG, PNG, or PDF |
| `Network error` | Backend not running | Start backend server |

## 📈 Future Enhancements

- [ ] Support for more languages (Hindi, Spanish, etc.)
- [ ] Handwriting recognition improvements
- [ ] Multi-page PDF batch processing
- [ ] Integration with EHR systems
- [ ] Voice readout of analysis
- [ ] Mobile app support
- [ ] Offline OCR capability

## 📚 Additional Resources

### Files in This Implementation

```
server/
└── routes/
    └── aiRoutes.js                    # Main API endpoint

src/
├── services/
│   └── geminiService.ts               # Frontend service
└── pages/
    └── MedicalDocumentAnalyzer.tsx    # Demo UI component
```

### Related Documentation
- [Tesseract.js Documentation](https://tesseract.projectnaptha.com/)
- [Google Gemini API Reference](https://ai.google.dev/api)
- [PDF Parse NPM](https://www.npmjs.com/package/pdf-parse)

## 📞 Support

For questions or issues:
1. Check the error message in the response JSON
2. Review server logs for detailed error traces
3. Verify file format and quality
4. Ensure backend server is running on port 5000

## 📝 License

This medical OCR analyzer is part of the VCMS (Virtual Clinic Management System) project.

---

**⚕️ Medical Disclaimer**: This tool is for informational purposes only and does not replace professional medical advice, diagnosis, or treatment. Always consult qualified healthcare providers.
