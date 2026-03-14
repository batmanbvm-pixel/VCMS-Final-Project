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
  aiWarning?: string;
  language?: string;
  isMedical?: boolean;
}


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
        aiWarning: response.data.aiWarning,
        language: response.data.language,
      };

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
