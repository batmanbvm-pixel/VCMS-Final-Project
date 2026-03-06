import api from './api';
import axios from 'axios';

/**
 * Service to interact with Gemini-backed API endpoints for summaries and analysis
 */

interface SummaryResponse {
  summary: string;
  keyPoints: string[];
  recommendations?: string[];
  detailedInstructions?: string;
  sideEffects?: string[];
  precautions?: string[];
  aiPowered?: boolean;
  language?: string;
  isMedical?: boolean;
}

const isEnglishOnlyText = (text?: string): boolean => {
  if (!text) return false;
  const englishChars = (text.match(/[A-Za-z]/g) || []).length;
  const gujaratiChars = (text.match(/[\u0A80-\u0AFF]/g) || []).length;
  const hindiChars = (text.match(/[\u0900-\u097F]/g) || []).length;
  return englishChars > 25 && gujaratiChars === 0 && hindiChars === 0;
};

const buildLocalizedPrescriptionFallback = (
  medications: any[],
  diagnosis: string,
  language: string
): SummaryResponse => {
  const medDetails = medications.map((m) => `💊 ${m.name || 'Medicine'} ${m.dosage || ''}, ${m.frequency || ''} ${m.duration ? `for ${m.duration}` : ''}`.trim());

  if (language === 'gujarati') {
    return {
      summary: diagnosis
        ? `તમને ${diagnosis} માટે સારવાર આપવામાં આવી છે. તમારી સ્થિતિ સુધરે તે માટે આ દવાઓ નિયમિત લેવી જરૂરી છે.`
        : `તમારી સારવાર માટે દવાઓ આપવામાં આવી છે. ડૉક્ટરની સૂચના મુજબ દવા સમયસર લો.`,
      detailedInstructions: medications.length > 0
        ? `દવા લેવાની સરળ રીત:\n\n${medications.map((m, i) => `પગલું ${i + 1}: ${m.name || 'દવા'} ${m.dosage || ''} ને ${m.frequency || 'ડૉક્ટરની સૂચના મુજબ'} લો ${m.duration ? `અને ${m.duration} સુધી ચાલુ રાખો.` : 'અને કોર્સ પૂર્ણ કરો.'}`).join('\n\n')}`
        : 'તમારા ડૉક્ટરની સલાહ મુજબ દવાઓ લો.',
      keyPoints: medDetails.length > 0 ? medDetails : ['તમારી પ્રિસ્ક્રિપ્શનની વિગતો ઉપર છે.'],
      sideEffects: [
        '🔹 હળવી ઉબકા અથવા પેટમાં અસ્વસ્થતા થઈ શકે',
        '🔹 ચક્કર કે ઊંઘ આવી શકે',
        '🔹 એલર્જી જેવા લક્ષણો દેખાય તો તરત ડૉક્ટરનો સંપર્ક કરો'
      ],
      precautions: [
        '⚠️ ડૉક્ટરની સલાહ વિના દવા બંધ ન કરો',
        '⚠️ દવાઓ બાળકોની પહોંચથી દૂર રાખો',
        '⚠️ ગંભીર તકલીફ થાય તો તરત હોસ્પિટલનો સંપર્ક કરો'
      ],
      recommendations: [
        '✅ દવા સમયસર લો',
        '✅ પૂરતું પાણી પીવો અને આરામ કરો',
        '✅ કોઈ આડઅસર થાય તો ડૉક્ટરને જણાવો'
      ],
      language: 'gujarati',
    };
  }

  if (language === 'hindi') {
    return {
      summary: diagnosis
        ? `आपको ${diagnosis} के लिए उपचार दिया गया है। आपकी स्थिति बेहतर हो इसके लिए दवाएं नियमित रूप से लेना जरूरी है।`
        : 'आपके इलाज के लिए दवाएं दी गई हैं। डॉक्टर की सलाह के अनुसार समय पर दवा लें।',
      detailedInstructions: medications.length > 0
        ? `दवा लेने की सरल गाइड:\n\n${medications.map((m, i) => `चरण ${i + 1}: ${m.name || 'दवा'} ${m.dosage || ''} को ${m.frequency || 'डॉक्टर के निर्देशानुसार'} लें ${m.duration ? `और ${m.duration} तक जारी रखें।` : 'और पूरा कोर्स पूरा करें।'}`).join('\n\n')}`
        : 'अपने डॉक्टर की सलाह के अनुसार दवाएं लें।',
      keyPoints: medDetails.length > 0 ? medDetails : ['आपकी प्रिस्क्रिप्शन का विवरण ऊपर दिया गया है।'],
      sideEffects: [
        '🔹 हल्की मतली या पेट में परेशानी हो सकती है',
        '🔹 चक्कर या नींद महसूस हो सकती है',
        '🔹 एलर्जी जैसे लक्षण हों तो तुरंत डॉक्टर से संपर्क करें'
      ],
      precautions: [
        '⚠️ डॉक्टर की सलाह बिना दवा बंद न करें',
        '⚠️ दवाएं बच्चों की पहुंच से दूर रखें',
        '⚠️ गंभीर परेशानी हो तो तुरंत अस्पताल जाएं'
      ],
      recommendations: [
        '✅ दवा समय पर लें',
        '✅ पर्याप्त पानी पिएं और आराम करें',
        '✅ कोई दुष्प्रभाव हो तो डॉक्टर को बताएं'
      ],
      language: 'hindi',
    };
  }

  return {
    summary: 'Your prescription summary is available above.',
    keyPoints: medDetails,
    language: 'english',
  };
};

export const geminiService = {
  async summarizePrescription(
    medications: any[],
    diagnosis: string,
    treatmentPlan: string,
    followUpRecommendations: string,
    language: string = 'english'
  ): Promise<SummaryResponse> {
    try {
      const prescriptionText = `
        Diagnosis: ${diagnosis}

        Medications:
        ${medications.map(m => `- ${m.name} ${m.dosage}, ${m.frequency} for ${m.duration}`).join('\n')}

        Treatment Plan: ${treatmentPlan}

        Follow-up Recommendations: ${followUpRecommendations}
      `;

      const response = await api.post('/ai/summarize', {
        type: 'prescription',
        content: prescriptionText,
        language,
        detailedMode: true,
      });

      const payload: SummaryResponse = {
        summary: response.data.summary,
        keyPoints: response.data.keyPoints || [],
        recommendations: response.data.recommendations || [],
        detailedInstructions: response.data.detailedInstructions,
        sideEffects: response.data.sideEffects || [],
        precautions: response.data.precautions || [],
        aiPowered: response.data.aiPowered,
        language: response.data.language,
      };

      if ((language === 'gujarati' || language === 'hindi') && isEnglishOnlyText(payload.summary)) {
        return buildLocalizedPrescriptionFallback(medications, diagnosis, language);
      }

      return payload;
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        const msg = error.response?.data?.error || error.response?.data?.message;
        if (msg) throw new Error(msg);
        if (error.code === 'ERR_NETWORK') {
          throw new Error('Backend server is not reachable on port 5000. Please start the backend server.');
        }
      }
      throw new Error('Failed to generate prescription summary');
    }
  },

  async analyzeReport(reportText: string, language: string = 'english'): Promise<SummaryResponse> {
    try {
      const response = await api.post('/ai/analyze-report', {
        type: 'report',
        content: reportText,
        language,
        detailedMode: true,
      });

      return {
        summary: response.data.summary,
        keyPoints: response.data.keyPoints || [],
        recommendations: response.data.recommendations || [],
        detailedInstructions: response.data.detailedInstructions,
        sideEffects: response.data.sideEffects || [],
        precautions: response.data.precautions || [],
        aiPowered: response.data.aiPowered,
        isMedical: response.data.isMedical,
      };
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        const msg = error.response?.data?.error || error.response?.data?.message;
        if (msg) throw new Error(msg);
        if (error.code === 'ERR_NETWORK') {
          throw new Error('Backend server is not reachable on port 5000. Please start the backend server.');
        }
      }
      throw new Error('Failed to analyze report');
    }
  },

  async extractTextFromImage(imageFile: File, language: string = 'english'): Promise<string> {
    try {
      const formData = new FormData();
      formData.append('file', imageFile);
      formData.append('language', language);

      const response = await api.post('/ai/extract-text', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      return response.data.text;
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        if (error.response?.data?.message) {
          throw new Error(error.response.data.message);
        }

        if (error.response?.data?.error) {
          throw new Error(error.response.data.error);
        }

        if (error.code === 'ERR_NETWORK') {
          throw new Error('Backend server is not reachable on port 5000. Please start the backend server.');
        }
      }

      throw new Error('Failed to extract text from image');
    }
  },

  async analyzeMedicalDocument(documentFile: File): Promise<any> {
    try {
      const formData = new FormData();
      formData.append('file', documentFile);

      const response = await api.post('/ai/analyze-medical-document', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      return response.data;
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        if (error.response?.data?.status) {
          return error.response.data;
        }

        if (error.response?.data?.message) {
          throw new Error(error.response.data.message);
        }

        if (error.code === 'ERR_NETWORK') {
          throw new Error('Backend server is not reachable on port 5000. Please start the backend server.');
        }
      }

      throw new Error('Failed to analyze medical document');
    }
  },
};

export default geminiService;
