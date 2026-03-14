const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const multer = require('multer');
const Tesseract = require('tesseract.js');
const pdfParse = require('pdf-parse');
const path = require('path');
const fs = require('fs');

const GEMINI_FALLBACK_MODELS = [
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  'gemini-1.5-flash-latest',
  'gemini-1.5-flash',
  'gemini-1.5-pro',
];

let geminiKeyCursor = 0;

const getGeminiApiKeys = () => {
  const keys = [];
  const first = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
  if (first) keys.push(first.trim());

  const pool = String(process.env.GEMINI_API_KEYS || '')
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean);

  for (const key of pool) {
    if (!keys.includes(key)) keys.push(key);
  }

  return keys;
};
const hasGeminiKey = () => getGeminiApiKeys().length > 0;

const getGeminiApiKeysInRotation = () => {
  const keys = getGeminiApiKeys();
  if (keys.length <= 1) return keys;

  const start = geminiKeyCursor % keys.length;
  geminiKeyCursor = (geminiKeyCursor + 1) % keys.length;

  return [...keys.slice(start), ...keys.slice(0, start)];
};

const cleanAiText = (value = '') => {
  let text = String(value || '')
    .replace(/```json|```/gi, '')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\r/g, '')
    .trim();

  if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) {
    text = text.slice(1, -1).trim();
  }

  return text
    .replace(/\\n/g, '\n')
    .replace(/\s{2,}/g, ' ')
    .trim();
};

const extractStringValueFromBrokenJson = (text = '', field = 'summary') => {
  const escapedRegex = new RegExp(`"${field}"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"`, 'i');
  const escapedMatch = String(text || '').match(escapedRegex);
  if (escapedMatch?.[1]) return cleanAiText(escapedMatch[1]);

  // Tolerate truncated JSON where closing quote is missing.
  const looseRegex = new RegExp(`"${field}"\\s*:\\s*"([\\s\\S]*?)(?:",\\s*"|"\\s*}|$)`, 'i');
  const looseMatch = String(text || '').match(looseRegex);
  if (looseMatch?.[1]) return cleanAiText(looseMatch[1]);

  return '';
};

const extractArrayFromBrokenJson = (text = '', field = 'keyPoints') => {
  const arrRegex = new RegExp(`"${field}"\\s*:\\s*\\[([\\s\\S]*?)(?:\\]|$)`, 'i');
  const match = String(text || '').match(arrRegex);
  if (!match?.[1]) return [];

  return match[1]
    .split(',')
    .map((item) => cleanAiText(item.replace(/^\s*"|"\s*$/g, '')))
    .filter(Boolean);
};

const parseEmbeddedJsonObject = (text = '') => {
  const cleaned = String(text || '').replace(/```json|```/gi, '').trim();
  if (!cleaned) return null;
  try {
    return JSON.parse(cleaned);
  } catch (_) {
    const obj = cleaned.match(/\{[\s\S]*\}/);
    if (!obj) return null;
    try {
      return JSON.parse(obj[0]);
    } catch (_) {
      return null;
    }
  }
};

const normalizeAiResponseObject = (value) => {
  const data = value && typeof value === 'object' ? { ...value } : {};

  // Some model outputs put full JSON inside summary/detailedInstructions text.
  const embedded =
    parseEmbeddedJsonObject(data.summary) ||
    parseEmbeddedJsonObject(data.detailedInstructions);

  const merged = embedded && typeof embedded === 'object'
    ? { ...data, ...embedded }
    : data;

  if (typeof merged.summary === 'string') {
    merged.summary = cleanAiText(merged.summary);
  }
  if (typeof merged.detailedInstructions === 'string') {
    merged.detailedInstructions = cleanAiText(merged.detailedInstructions);
  }

  const toArray = (input) => {
    if (Array.isArray(input)) return input.filter(Boolean).map((v) => String(v).trim()).filter(Boolean);
    if (typeof input === 'string') {
      return input
        .split(/\n|•|-|\*/g)
        .map((v) => v.trim())
        .filter(Boolean);
    }
    return [];
  };

  merged.keyPoints = toArray(merged.keyPoints);
  merged.recommendations = toArray(merged.recommendations);
  merged.sideEffects = toArray(merged.sideEffects);
  merged.precautions = toArray(merged.precautions);

  // Ensure sections are not duplicated copies of summary text.
  if (merged.summary) {
    const summaryNormalized = merged.summary.toLowerCase();
    merged.keyPoints = merged.keyPoints.filter((p) => String(p).toLowerCase() !== summaryNormalized);
    merged.recommendations = merged.recommendations.filter((p) => String(p).toLowerCase() !== summaryNormalized);
  }

  if (!merged.keyPoints.length && merged.summary) {
    merged.keyPoints = [merged.summary];
  }

  return merged;
};

const parseJsonFromText = (text = '') => {
  const cleaned = cleanAiText(text);

  const safeParse = (raw) => {
    let normalized = String(raw || '')
      .replace(/,\s*([}\]])/g, '$1')
      .trim();

    // Common truncation repair: close braces/brackets if obviously incomplete.
    const openCurly = (normalized.match(/\{/g) || []).length;
    const closeCurly = (normalized.match(/\}/g) || []).length;
    const openSquare = (normalized.match(/\[/g) || []).length;
    const closeSquare = (normalized.match(/\]/g) || []).length;
    if (openSquare > closeSquare) normalized += ']'.repeat(openSquare - closeSquare);
    if (openCurly > closeCurly) normalized += '}'.repeat(openCurly - closeCurly);

    return JSON.parse(normalized);
  };

  try {
    return normalizeAiResponseObject(safeParse(cleaned));
  } catch (_) {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return normalizeAiResponseObject(safeParse(match[0]));
      } catch (_) {}
    }

    // Last-resort tolerant extraction for partially formatted model output
    const fallbackSummary = extractStringValueFromBrokenJson(cleaned, 'summary') ||
      cleaned.split('\n').map((line) => line.trim()).find(Boolean) ||
      'Unable to parse AI response cleanly, but summary was generated.';

    const detailedInstructions = extractStringValueFromBrokenJson(cleaned, 'detailedInstructions');

    return normalizeAiResponseObject({
      summary: fallbackSummary,
      keyPoints: extractArrayFromBrokenJson(cleaned, 'keyPoints'),
      recommendations: extractArrayFromBrokenJson(cleaned, 'recommendations'),
      sideEffects: extractArrayFromBrokenJson(cleaned, 'sideEffects'),
      precautions: extractArrayFromBrokenJson(cleaned, 'precautions'),
      detailedInstructions,
    });
  }
};

const discoverGeminiModels = async (apiKey) => {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
  const resp = await fetch(endpoint, { method: 'GET' });
  if (!resp.ok) {
    throw new Error(`List models failed: ${resp.status}`);
  }

  const data = await resp.json();
  const models = (data?.models || [])
    .filter((m) => Array.isArray(m?.supportedGenerationMethods) && m.supportedGenerationMethods.includes('generateContent'))
    .map((m) => String(m?.name || '').replace(/^models\//, '').trim())
    .filter(Boolean)
    .filter((name) => name.includes('gemini'));

  const unique = [...new Set(models)];
  if (unique.length === 0) return GEMINI_FALLBACK_MODELS;

  // Prefer flash/2.x first for speed and lower quota pressure.
  return unique.sort((a, b) => {
    const score = (name) => {
      const n = name.toLowerCase();
      if (n.includes('2.0') && n.includes('flash')) return 1;
      if (n.includes('flash-lite')) return 2;
      if (n.includes('flash')) return 3;
      if (n.includes('1.5-pro') || n.includes('pro')) return 5;
      return 4;
    };
    return score(a) - score(b);
  });
};

const generateJsonWithGemini = async (prompt) => {
  const apiKeys = getGeminiApiKeysInRotation();
  if (apiKeys.length === 0) {
    throw new Error('Gemini API key missing');
  }

  const errors = [];
  const exhaustedKeys = new Set();

  keyLoop: for (const apiKey of apiKeys) {
    const keySnip = apiKey.slice(0, 15) + '...';

    // Skip keys already marked as exhausted/invalid in this request.
    if (exhaustedKeys.has(apiKey)) {
      console.warn(`[Gemini] ⏭️  Skipping already-exhausted key: ${keySnip}`);
      continue keyLoop;
    }

    let models = GEMINI_FALLBACK_MODELS;
    try {
      models = await discoverGeminiModels(apiKey);
    } catch (err) {
      errors.push(`Model discovery failed for key ${keySnip}: ${err.message}`);
      // If discovery itself fails (bad key, no network), skip this key.
      exhaustedKeys.add(apiKey);
      continue keyLoop;
    }

    for (const model of models) {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const configs = [
        { temperature: 0.3, maxOutputTokens: 8192, responseMimeType: 'application/json' },
        { temperature: 0.3, maxOutputTokens: 8192 },
        { temperature: 0.3, maxOutputTokens: 4096 },
      ];

      for (const generationConfig of configs) {
        let resp;
        try {
          resp = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig,
            }),
          });
        } catch (networkErr) {
          errors.push(`[${model}] Network error: ${networkErr.message}`);
          console.error(`[Gemini] 🌐 Network error with key ${keySnip} / model ${model}: ${networkErr.message}`);
          exhaustedKeys.add(apiKey);
          continue keyLoop;
        }

        if (resp.ok) {
          const data = await resp.json();
          const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
          console.log(`[Gemini] ✅ Success with key ${keySnip} / model ${model}`);
          return parseJsonFromText(text);
        }

        const errText = await resp.text();
        const errSnip = errText.slice(0, 400);
        errors.push(`[${model}] ${resp.status} ${errSnip}`);
        console.error(`[Gemini] ❌ key=${keySnip} model=${model} → HTTP ${resp.status}: ${errSnip}`);

        const isQuotaIssue       = resp.status === 429;
        const isRevokedKey        = resp.status === 403;
        const isInvalidKey        = resp.status === 400 && /api.?key|invalid.?key|bad.?key/i.test(errText);
        const isServiceUnavail    = resp.status === 503;
        const isInvalidModel      = resp.status === 404;
        const isBadMimeType       = resp.status === 400 && /response_mime_type|unsupported/i.test(errText);
        const isTokenLimit        = resp.status === 400 && /user location|token|context length|too long/i.test(errText);

        if (isRevokedKey || isInvalidKey) {
          // Key is revoked, leaked, or invalid — mark & immediately try next key.
          console.error(`[Gemini] 🔑 Key invalid/revoked (${resp.status}): ${keySnip} — switching to next key`);
          exhaustedKeys.add(apiKey);
          continue keyLoop;
        }

        if (isQuotaIssue) {
          // Quota exhausted for this key — immediately switch to next key.
          console.warn(`[Gemini] ⚠️  Quota limit hit for key ${keySnip} — switching to next key`);
          exhaustedKeys.add(apiKey);
          continue keyLoop;
        }

        if (isServiceUnavail) {
          // Model overloaded — try next model (same key).
          break;
        }

        if (isBadMimeType) {
          // Unsupported MIME type for this config — try next config.
          continue;
        }

        if (isInvalidModel || isTokenLimit) {
          // Model not found or prompt too large — skip this model.
          break;
        }

        // Other 4xx/5xx — try next config.
        continue;
      }
    }

    // All models exhausted for this key without success.
    console.warn(`[Gemini] ⚠️  All models exhausted for key ${keySnip} — trying next key`);
  }

  throw new Error(`Gemini request failed across all keys/models. Keys tried: ${apiKeys.length}, exhausted: ${exhaustedKeys.size}. Details: ${errors.join(' | ')}`);
};

const isEnglishOnlyText = (text = '') => {
  if (!text) return false;
  const englishChars = (text.match(/[A-Za-z]/g) || []).length;
  const gujaratiChars = (text.match(/[\u0A80-\u0AFF]/g) || []).length;
  const hindiChars = (text.match(/[\u0900-\u097F]/g) || []).length;
  return englishChars > 25 && gujaratiChars === 0 && hindiChars === 0;
};

// Rule-based summary specifically for prescriptions (no Gemini key) - WITH LANGUAGE SUPPORT
const ruleBasedPrescriptionSummary = (content, language = 'english') => {
  // Normalize and validate language
  language = String(language || 'english').toLowerCase().trim();
  if (!['gujarati', 'hindi', 'english'].includes(language)) {
    language = 'english';
  }

  // Try to parse as JSON first (actual prescription structure)
  let diagnosis = '';
  let medications = [];
  let treatmentPlan = '';
  let followUp = '';
  let followUpDate = '';

  try {
    // Check if content is already a JSON object or string
    const parsed = typeof content === 'string' ? JSON.parse(content) : content;
    if (parsed && typeof parsed === 'object') {
      diagnosis = parsed.diagnosis || '';
      medications = Array.isArray(parsed.medications) 
        ? parsed.medications.map(m => {
            const parts = [
              m.name || 'Medication',
              m.dosage || '',
              m.frequency || '',
              m.duration || ''
            ].filter(Boolean);
            return parts.join(', ');
          })
        : [];
      treatmentPlan = parsed.treatmentPlan || parsed.clinicalNotes || '';
      followUp = parsed.followUpRecommendations || '';
      followUpDate = parsed.followUpDate || '';

    }
  } catch (e) {
    // Not JSON, try text parsing

    const lines = String(content).split('\n').map(l => l.trim()).filter(Boolean);

    for (const line of lines) {
      if (line.startsWith('Diagnosis:')) diagnosis = line.replace('Diagnosis:', '').trim();
      else if (line.startsWith('Treatment Plan:')) treatmentPlan = line.replace('Treatment Plan:', '').trim();
      else if (line.startsWith('Follow-up Recommendations:')) followUp = line.replace('Follow-up Recommendations:', '').trim();
      else if (line.startsWith('Follow-up Date:')) followUpDate = line.replace('Follow-up Date:', '').trim();
      else if (/^[-•]\s/.test(line)) {
        const medText = line.replace(/^[-•]\s*/, '').trim();
        medications.push(medText);
      }
    }
  }



  // Language-specific translations
  const translations = {
    gujarati: {
      summary: diagnosis
        ? `તમને ${diagnosis} ની સારવાર માટે દવાઓ આપવામાં આવી છે. કુલ ${medications.length} દવાઓ આપવામાં આવી છે જે તમારી સ્થિતિને નિયંત્રણમાં રાખવામાં મદદ કરશે.`
        : `તમારી પ્રિસ્ક્રિપ્શનમાં ${medications.length} દવાઓ છે. તમારા ડૉક્ટરની સૂચનાઓ ધ્યાનથી પાલન કરો.`,
      detailedInstructions: medications.length > 0
        ? medications.map((med, i) => {
            const parts = med.split(',').map(p => p.trim());
            const name = parts[0] || 'દવા';
            const dosage = parts[1] || 'જેમ સૂચવવામાં આવે';
            const frequency = parts[2] || 'જેમ નિર્દેશવામાં આવે';
            const duration = parts[3] || 'જેમ ભલીમણ કરવામાં આવે';
            return `પગલું ${i + 1}: ${name} (${dosage}): ${frequency} લો અને ${duration} સુધી ચાલુ રાખો`;
          }).join('\n\n')
        : 'તમારા ડૉક્ટરની સૂચનાઓ અનુસાર દવાઓ લો.',
      recommendations: [
        '✅ દવાઓ બરાબર સૂચનાઓ અનુસાર લો અને સંપૂર્ણ કોર્સ પૂરો કરો',
        '✅ કોઈ અનપેક્ષિત આડ-અસર આવે તો તમારા ડૉક્ટરને તુરંત જણાવો'
      ],
    },
    hindi: {
      summary: diagnosis
        ? `आपको ${diagnosis} के इलाज के लिए दवाएं दी गई हैं। कुल ${medications.length} दवाएं दी गई हैं जो आपकी स्थिति को नियंत्रित करने में मदद करेंगी।`
        : `आपकी प्रिस्क्रिप्शन में ${medications.length} दवाएं हैं। अपने डॉक्टर की सलाह को ध्यान से पालन करें।`,
      detailedInstructions: medications.length > 0
        ? medications.map((med, i) => {
            const parts = med.split(',').map(p => p.trim());
            const name = parts[0] || 'दवा';
            const dosage = parts[1] || 'जैसा निर्देशित';
            const frequency = parts[2] || 'जैसा सुझाया गया';
            const duration = parts[3] || 'जैसा अनुशंसित';
            return `चरण ${i + 1}: ${name} (${dosage}): ${frequency} लें और ${duration} तक जारी रखें`;
          }).join('\n\n')
        : 'अपने डॉक्टर की सलाह के अनुसार दवाएं लें।',
      recommendations: [
        '✅ दवाओं को बिल्कुल निर्देशों के अनुसार लें और पूरा इलाज पूरा करें',
        '✅ किसी भी अप्रत्याशित दुष्प्रभाव के लिए तुरंत अपने डॉक्टर को सूचित करें'
      ],
    },
    english: {
      summary: diagnosis
        ? `You have been prescribed treatment for ${diagnosis}. A total of ${medications.length} medication${medications.length !== 1 ? 's have' : ' has'} been prescribed to help manage your condition.`
        : `Your prescription includes ${medications.length} medication${medications.length !== 1 ? 's' : ''}. Follow your doctor's instructions carefully.`,
      detailedInstructions: medications.length > 0
        ? medications.map((med, i) => {
            const parts = med.split(',').map(p => p.trim());
            const name = parts[0] || 'Medication';
            const dosage = parts[1] || 'as prescribed';
            const frequency = parts[2] || 'as directed';
            const duration = parts[3] || 'as recommended';
            return `Step ${i + 1}: ${name} (${dosage}): Take ${frequency} for ${duration}`;
          }).join('\n\n')
        : 'Follow the prescription instructions provided by your healthcare provider.',
      recommendations: [
        '✅ Take all medications exactly as prescribed and complete the full course',
        '✅ Contact your doctor if you experience any unexpected side effects'
      ],
    }
  };

  const lang = translations[language] || translations.english;
  


  // Generate language-specific keyPoints for medications with actual details
  let keyPointsDisplay = [];
  if (medications.length > 0) {
    keyPointsDisplay = medications.map((med, idx) => {
      // Show full medication details
      return `💊 ${med}`;
    });
  } else {
    keyPointsDisplay = language === 'gujarati' 
      ? ['તમારી પ્રિસ્ક્રિપ્શનનો વિગત ઉપર આપેલ છે.']
      : language === 'hindi'
      ? ['आपकी प्रिस्क्रिप्शन का विवरण ऊपर दिया गया है।']
      : ['Your prescription details are listed above.'];
  }

  // Generate unique recommendations based on actual treatment
  const uniqueRecommendations = [];
  if (language === 'english') {
    if (diagnosis) uniqueRecommendations.push(`✅ Follow the complete treatment course for ${diagnosis}`);
    if (treatmentPlan) uniqueRecommendations.push(`✅ ${treatmentPlan}`);
    if (followUp) uniqueRecommendations.push(`✅ ${followUp}`);
    if (followUpDate) uniqueRecommendations.push(`✅ Schedule follow-up for ${followUpDate}`);
  } else if (language === 'hindi') {
    if (diagnosis) uniqueRecommendations.push(`✅ ${diagnosis} के लिए पूरा इलाज पूरा करें`);
    if (treatmentPlan) uniqueRecommendations.push(`✅ ${treatmentPlan}`);
    if (followUp) uniqueRecommendations.push(`✅ ${followUp}`);
    if (followUpDate) uniqueRecommendations.push(`✅ ${followUpDate} को फॉलो-अप लें`);
  } else if (language === 'gujarati') {
    if (diagnosis) uniqueRecommendations.push(`✅ ${diagnosis} માટે સંપૂર્ણ સારવાર પૂર્ણ કરો`);
    if (treatmentPlan) uniqueRecommendations.push(`✅ ${treatmentPlan}`);
    if (followUp) uniqueRecommendations.push(`✅ ${followUp}`);
    if (followUpDate) uniqueRecommendations.push(`✅ ${followUpDate} પર ફોલો-અપ લો`);
  }

  // Only include generic recommendations if no specific ones
  const finalRecommendations = uniqueRecommendations.length > 0 
    ? uniqueRecommendations 
    : lang.recommendations.slice(0, 2); // Just 2 generic ones if no specific data

  return {
    summary: lang.summary,
    keyPoints: keyPointsDisplay,
    recommendations: finalRecommendations,
    detailedInstructions: lang.detailedInstructions,
    // Remove generic side effects and precautions - they're the same for everyone
  };
};

// Parse raw prescription text extracted from PDF/screenshot
const parsePrescriptionRawText = (text) => {
  const lower = text.toLowerCase();

  const noisePatterns = [
    /^https?:\/\//i,
    /^localhost:/i,
    /^\d+\/\d+\/\d+/i,
    /^page\s*\d+/i,
    /^\d+\/\d+$/i,
    /^medi(connect)?\b/i,
    /^about\b/i,
    /^contact\b/i,
    /^back\b/i,
    /^print\b/i,
    /^draft\b/i,
    /^pp$/i,
    /^!+$/,
  ];

  const isNoiseLine = (line) => {
    if (!line) return true;
    const compact = line.replace(/\s+/g, ' ').trim();
    if (!compact) return true;
    if (compact.length <= 1) return true;
    if (noisePatterns.some((p) => p.test(compact))) return true;
    return false;
  };

  const cleanedText = String(text || '').replace(/\u0000/g, ' ').replace(/[\t\f\v]+/g, ' ');
  const lines = cleanedText
    .split(/[\n\r]+/)
    .map(l => l.replace(/\s+/g, ' ').trim())
    .filter((l) => !isNoiseLine(l));

  let patientName = '';
  let doctorName = '';
  let specialty = '';
  let diagnosis = '';
  let clinicalNotes = '';
  const medications = [];

  // Extract patient name (line after "PATIENT" label)
  for (let i = 0; i < lines.length; i++) {
    const up = lines[i].toUpperCase();
    if (up === 'PATIENT' || up.endsWith('PATIENT')) {
      // Next non-email non-short line is the name
      for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
        if (!lines[j].includes('@') && lines[j].length > 2 && !/^(DOCTOR|MEDICATION|DOSAGE|FREQUENCY|DURATION)/i.test(lines[j])) {
          patientName = lines[j]; break;
        }
      }
    }
    if (up === 'DOCTOR' || up.endsWith('DOCTOR')) {
      for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
        if (!doctorName && lines[j].length > 2 && !/^(PATIENT|MEDICATION|DOSAGE)/i.test(lines[j])) {
          doctorName = lines[j].replace(/^Dr\.?\s*/i, ''); 
        } else if (doctorName && !specialty && lines[j].length > 2) {
          specialty = lines[j]; break;
        }
      }
    }
    if (/clinical\s*notes?/i.test(lines[i]) && i + 1 < lines.length) {
      clinicalNotes = lines[i + 1];
      diagnosis = clinicalNotes;
    }
    if (/^diagnosis[:\s]/i.test(lines[i])) {
      diagnosis = lines[i].replace(/^diagnosis[:\s]*/i, '').trim() || (lines[i + 1] || '');
    }
  }

  // Extract medications: tolerate OCR where labels and values are split across lines
  let inMedBlock = false;
  let curMed = null;
  const stopWords = new Set([
    'patient', 'doctor', 'clinical notes', 'issued', 'follow-up recommended',
    'prescription', 'medical prescription details', 'medications'
  ]);

  const readNextValue = (currentIndex) => {
    let j = currentIndex + 1;
    while (j < lines.length) {
      const candidate = (lines[j] || '').trim();
      const lc = candidate.toLowerCase();
      if (!candidate) { j++; continue; }
      if (isNoiseLine(candidate)) { j++; continue; }
      if (/^(medication|dosage|frequency|duration|instructions?|doctor|patient|clinical notes|follow-up recommended)$/i.test(lc)) {
        j++;
        continue;
      }
      return { value: candidate, consumedIndex: j };
    }
    return { value: '', consumedIndex: currentIndex };
  };

  const normalizeFreq = (value = '') => {
    const v = value.toLowerCase();
    if (v === '1') return 'once daily';
    if (v === '2') return 'twice daily';
    if (v === '3') return 'thrice daily';
    return value;
  };

  const normalizeDuration = (value = '') => {
    const v = value.toLowerCase();
    if (v === '1') return '1 day';
    if (v === '2') return '2 days';
    if (v === '3') return '3 days';
    if (/^\d+$/.test(v)) return `${value} days`;
    return value;
  };

  const maybePushCurrent = () => {
    if (!curMed || !curMed.name) return;
    const normalizedName = curMed.name.replace(/\s+/g, ' ').trim();
    if (!normalizedName) return;
    if (stopWords.has(normalizedName.toLowerCase())) return;
    if (normalizedName.length < 2) return;
    medications.push({
      ...curMed,
      name: normalizedName,
      frequency: normalizeFreq(curMed.frequency || ''),
      duration: normalizeDuration(curMed.duration || ''),
    });
  };

  for (let i = 0; i < lines.length; i++) {
    const up = lines[i].toUpperCase();
    if (up === 'MEDICATIONS' || up === 'MEDICATION') { inMedBlock = true; continue; }
    if (!inMedBlock) continue;

    if (up === 'MEDICATION' || /^medication\b/i.test(lines[i])) {
      maybePushCurrent();
      curMed = { name: '', dosage: '', frequency: '', duration: '', instructions: '' };
      const nameCandidate = lines[i].replace(/^medication[:\s]*/i, '').trim();
      if (nameCandidate.length > 1 && !stopWords.has(nameCandidate.toLowerCase())) {
        curMed.name = nameCandidate;
      } else {
        const next = readNextValue(i);
        if (next.value && !stopWords.has(next.value.toLowerCase())) {
          curMed.name = next.value;
          i = next.consumedIndex;
        }
      }
    } else if (/^dosage[:\s]*/i.test(lines[i])) {
      const v = lines[i].replace(/^dosage[:\s]*/i, '').trim();
      if (curMed) {
        if (v) curMed.dosage = v;
        else {
          const next = readNextValue(i);
          curMed.dosage = next.value || '';
          i = next.consumedIndex;
        }
      }
    } else if (/^frequency[:\s]*/i.test(lines[i])) {
      const v = lines[i].replace(/^frequency[:\s]*/i, '').trim();
      if (curMed) {
        if (v) curMed.frequency = normalizeFreq(v);
        else {
          const next = readNextValue(i);
          curMed.frequency = normalizeFreq(next.value || '');
          i = next.consumedIndex;
        }
      }
    } else if (/^duration[:\s]*/i.test(lines[i])) {
      const v = lines[i].replace(/^duration[:\s]*/i, '').trim();
      if (curMed) {
        if (v) curMed.duration = normalizeDuration(v);
        else {
          const next = readNextValue(i);
          curMed.duration = normalizeDuration(next.value || '');
          i = next.consumedIndex;
        }
      }
    } else if (/^instructions?[:\s]*/i.test(lines[i])) {
      const v = lines[i].replace(/^instructions?[:\s]*/i, '').trim();
      if (curMed) {
        if (v) curMed.instructions = v;
        else {
          const next = readNextValue(i);
          curMed.instructions = next.value || '';
          i = next.consumedIndex;
        }
      }
    } else if (/^follow-?up recommended/i.test(lines[i])) {
      const inline = lines[i].replace(/^follow-?up recommended[:\s]*/i, '').trim();
      if (inline) followUpDate = inline;
      else {
        const next = readNextValue(i);
        if (next.value) {
          followUpDate = next.value;
          i = next.consumedIndex;
        }
      }
    }
  }
  maybePushCurrent();

  // Remove obvious duplicates caused by OCR repetition across PDF pages
  const deduped = [];
  const seen = new Set();
  for (const m of medications) {
    const k = `${(m.name || '').toLowerCase()}|${(m.dosage || '').toLowerCase()}|${(m.frequency || '').toLowerCase()}|${(m.duration || '').toLowerCase()}`;
    if (seen.has(k)) continue;
    seen.add(k);
    deduped.push(m);
  }

  const docLabel = doctorName ? ` by Dr. ${doctorName}${specialty ? ' (' + specialty + ')' : ''}` : '';
  const diagLabel = diagnosis ? ` Treated condition: ${diagnosis}.` : '';
  const summary = deduped.length > 0
    ? `This prescription${docLabel} lists ${deduped.length} medication${deduped.length !== 1 ? 's' : ''}${diagLabel} Follow your doctor's instructions carefully.`
    : `Medical prescription document${docLabel} detected.${diagLabel} See medication details below.`;

  const keyPoints = deduped.length > 0
    ? deduped.map(m => {
        const parts = [`💊 ${m.name || 'Medication'}`];
        if (m.dosage) parts.push(`— ${m.dosage}`);
        if (m.frequency) parts.push(`• ${m.frequency}`);
        if (m.duration) parts.push(`for ${m.duration}`);
        return parts.join(' ');
      })
    : ['Prescription identified. Check extracted text for full medication list.'];

  const recommendations = [];
  deduped.forEach(m => {
    if (m.instructions) recommendations.push(`📋 ${m.name}: ${m.instructions}`);
  });
  if (followUpDate) {
    recommendations.push(`📅 Follow-up suggested around: ${followUpDate}`);
  }
  recommendations.push('Take all medications exactly as prescribed — complete the full course even if you feel better.');
  recommendations.push('Contact your doctor immediately if you experience severe side effects.');

  return {
    summary,
    keyPoints,
    recommendations,
    parsed: {
      patientName,
      doctorName,
      specialty,
      diagnosis,
      clinicalNotes,
      medications: deduped,
      followUpDate,
    },
  };
};

const buildDetailedPrescriptionLaymanAnalysis = (text, language = 'english') => {
  const lang = String(language || 'english').toLowerCase().trim();
  const parsedData = parsePrescriptionRawText(text);
  const details = parsedData.parsed || {};
  const medications = Array.isArray(details.medications) ? details.medications : [];

  const medKeyPoints = medications.length > 0
    ? medications.map((m, index) => {
        const parts = [
          `${index + 1}) ${m.name || 'Medication'}`,
          m.dosage ? `Dose: ${m.dosage}` : null,
          m.frequency ? `Frequency: ${m.frequency}` : null,
          m.duration ? `Duration: ${m.duration}` : null,
          m.instructions ? `How to take: ${m.instructions}` : null,
        ].filter(Boolean);
        return `💊 ${parts.join(' | ')}`;
      })
    : parsedData.keyPoints;

  const topMeds = medications.slice(0, 3).map((m) => m.name || 'medicine');

  if (lang === 'hindi') {
    const summary = details.diagnosis
      ? `यह ${details.diagnosis} के इलाज की प्रिस्क्रिप्शन है। कुल ${medications.length || 'कुछ'} दवाएं लिखी गई हैं। दवा की मात्रा, समय और अवधि का सही पालन करना जरूरी है।`
      : `यह दवा उपचार की प्रिस्क्रिप्शन है। दवा समय पर और सही मात्रा में लेना जरूरी है।`;

    const sideEffects = topMeds.length > 0
      ? topMeds.map((name) => `🔹 ${name} से हल्की मतली, पेट में असहजता या चक्कर हो सकता है`)
      : ['🔹 कुछ दवाओं से हल्की मतली, पेट में असहजता या चक्कर हो सकता है'];

    const precautions = topMeds.length > 0
      ? topMeds.map((name) => `⚠️ ${name} डॉक्टर की सलाह के बिना बंद/बदलें नहीं`)
      : ['⚠️ दवा डॉक्टर की सलाह के बिना बंद या बदलें नहीं'];

    return {
      summary,
      keyPoints: medKeyPoints,
      detailedInstructions: [
        'चरण 1: दवाओं के नाम, मात्रा और समय लिख लें।',
        'चरण 2: हर दवा डॉक्टर द्वारा बताए समय पर लें।',
        'चरण 3: कोई डोज छूटे तो डबल डोज न लें।',
        'चरण 4: पूरा कोर्स पूरा करें और समस्या हो तो डॉक्टर से संपर्क करें।',
      ].join('\n'),
      sideEffects,
      precautions,
      recommendations: [
        '✅ दवा लेने का दैनिक चार्ट बनाएँ',
        '✅ पानी, आराम और हल्का भोजन रखें',
        '✅ 48-72 घंटे में सुधार न हो तो डॉक्टर से मिलें',
      ],
    };
  }

  if (lang === 'gujarati') {
    const summary = details.diagnosis
      ? `આ ${details.diagnosis} માટેની પ્રિસ્ક્રિપ્શન છે. કુલ ${medications.length || 'કેટલીક'} દવાઓ આપવામાં આવી છે. માત્રા, સમય અને અવધિનું સાચું પાલન કરવું જરૂરી છે.`
      : 'આ દવા સારવારની પ્રિસ્ક્રિપ્શન છે. દવા સમયસર અને યોગ્ય માત્રામાં લેવી જરૂરી છે.';

    const sideEffects = topMeds.length > 0
      ? topMeds.map((name) => `🔹 ${name} થી હળવી ઉબકા, પેટમાં અસ્વસ્થતા અથવા ચક્કર થઈ શકે`)
      : ['🔹 કેટલીક દવાઓથી હળવી ઉબકા, પેટમાં અસ્વસ્થતા અથવા ચક્કર થઈ શકે'];

    const precautions = topMeds.length > 0
      ? topMeds.map((name) => `⚠️ ${name} ડૉક્ટરની સલાહ વિના બંધ/બદલો નહીં`)
      : ['⚠️ દવા ડૉક્ટરની સલાહ વિના બંધ અથવા બદલો નહીં'];

    return {
      summary,
      keyPoints: medKeyPoints,
      detailedInstructions: [
        'પગલું 1: દવાઓના નામ, ડોઝ અને સમય લખી લો.',
        'પગલું 2: દરેક દવા ડૉક્ટરના સમય પ્રમાણે લો.',
        'પગલું 3: ડોઝ ચૂકી જાઓ તો ડબલ ડોઝ ન લો.',
        'પગલું 4: સંપૂર્ણ કોર્સ પૂર્ણ કરો અને સમસ્યા થાય તો ડૉક્ટરને સંપર્ક કરો.',
      ].join('\n'),
      sideEffects,
      precautions,
      recommendations: [
        '✅ દવા માટે દૈનિક ચેકલિસ્ટ બનાવો',
        '✅ પૂરતું પાણી, આરામ અને હળવો આહાર રાખો',
        '✅ 2-3 દિવસમાં સુધારો ન થાય તો ડૉક્ટરને ફરી બતાવો',
      ],
    };
  }

  const summary = details.diagnosis
    ? `This is a prescription for ${details.diagnosis}. It lists ${medications.length || 'multiple'} medicines with dose, timing, and duration instructions. Follow the plan exactly for better recovery.`
    : 'This is a medical prescription with medicine dose, timing, and duration instructions. Follow it exactly as written.';

  const sideEffects = topMeds.length > 0
    ? topMeds.map((name) => `🔹 ${name}: mild nausea, stomach upset, or dizziness can occur`)
    : ['🔹 Mild nausea, stomach upset, or dizziness can occur with some medicines'];

  const precautions = topMeds.length > 0
    ? topMeds.map((name) => `⚠️ ${name}: do not stop or change dose without medical advice`)
    : ['⚠️ Do not stop or change dose without medical advice'];

  return {
    summary,
    keyPoints: medKeyPoints,
    detailedInstructions: [
      'Step 1: Note medicine name, dose, and schedule.',
      'Step 2: Take each dose exactly at the prescribed time.',
      'Step 3: If a dose is missed, do not double the next dose.',
      'Step 4: Complete the full course and contact your doctor if symptoms worsen.',
    ].join('\n'),
    sideEffects,
    precautions,
    recommendations: [
      '✅ Keep a daily medicine checklist',
      '✅ Maintain hydration, sleep, and light meals',
      '✅ Follow up with your doctor if no improvement in 48-72 hours',
    ],
  };
};

// Rule-based fallback analysis when no Gemini key
const ruleBasedAnalysis = (text, language = 'english') => {
  const lower = text.toLowerCase();
  const lang = String(language || 'english').toLowerCase().trim();

  // Detect if prescription
  const isPrescription = (lower.includes('prescription') || lower.includes('medications') || lower.includes('dr') || lower.includes('doctor')) && 
                        (lower.includes('dosage') || lower.includes('frequency') || lower.includes('medicine') || lower.includes('tablet'));

  const localized = {
    english: {
      nonMedicalSummary: 'This document does not appear to be a medical report or prescription. Please upload a valid medical document such as a lab report, prescription, or clinical notes.',
      nonMedicalPoint: 'No medical content detected in the uploaded file',
      nonMedicalRecommendation: 'Please upload a valid medical document (lab report, prescription, test results, etc.)',
      prescriptionSummary: 'This is a prescription from your doctor with medicines to treat your health condition. Follow all instructions written on the prescription carefully.',
      prescriptionPoint1: '💊 This document contains prescribed medicines from your doctor',
      prescriptionPoint2: '📝 Follow exactly as written - check dosage, timing, and duration',
      prescriptionPoint3: '⏰ Take medicines at the times mentioned in the prescription',
      prescriptionRecommendation1: '✅ Read the prescription carefully - note if any medicine needs to be taken with food or on empty stomach',
      prescriptionRecommendation2: '⚠️ If you experience any unusual symptoms or side effects, contact your doctor immediately',
      prescriptionRecommendation3: '🚫 Complete the full course - do not stop medicines on your own even if you feel better',
      prescriptionRecommendation4: '❓ If you have any doubts about how to take the medicines, ask your doctor or pharmacist for clarification',
      genericPoint1: 'Medical document successfully extracted and processed',
      genericPoint2: 'Document contains relevant health-related text',
      genericRecommendation1: 'Please consult your doctor for a detailed interpretation of this report',
      genericRecommendation2: 'Keep this report for your medical records',
      reportAboutPrefix: 'What this report is about:',
      reportActionPrefix: 'What you should do now:',
      urgencyImmediate: 'Seek urgent medical help if you have severe chest pain, breathing trouble, confusion, very high fever, or fainting.',
      urgencyRoutine: 'Book a routine doctor follow-up and carry this report for final diagnosis and treatment decisions.',
    },
    hindi: {
      nonMedicalSummary: 'यह दस्तावेज़ मेडिकल रिपोर्ट या प्रिस्क्रिप्शन जैसा नहीं लगता। कृपया लैब रिपोर्ट, प्रिस्क्रिप्शन या क्लिनिकल नोट्स जैसी वैध मेडिकल फाइल अपलोड करें।',
      nonMedicalPoint: 'अपलोड की गई फाइल में मेडिकल सामग्री नहीं मिली',
      nonMedicalRecommendation: 'कृपया वैध मेडिकल दस्तावेज़ अपलोड करें (लैब रिपोर्ट, प्रिस्क्रिप्शन, टेस्ट रिपोर्ट आदि)।',
      prescriptionSummary: 'यह आपके डॉक्टर का प्रिस्क्रिप्शन है जिसमें आपकी बीमारी के लिए दवाएं लिखी गई हैं। प्रिस्क्रिप्शन पर लिखी सभी बातों को ध्यान से फॉलो करें।',
      prescriptionPoint1: '💊 यह दस्तावेज़ में आपके डॉक्टर की लिखी दवाएं हैं',
      prescriptionPoint2: '📝 बिल्कुल वैसे ही लें जैसे लिखा है - मात्रा, समय और अवधि देखें',
      prescriptionPoint3: '⏰ प्रिस्क्रिप्शन में लिखे समय पर दवा लें',
      prescriptionRecommendation1: '✅ प्रिस्क्रिप्शन को ध्यान से पढ़ें - देखें कि कौनसी दवा खाने के साथ या खाली पेट लेनी है',
      prescriptionRecommendation2: '⚠️ अगर कोई असामान्य लक्षण या साइड इफेक्ट हो तो तुरंत डॉक्टर से संपर्क करें',
      prescriptionRecommendation3: '🚫 पूरा कोर्स पूरा करें - ठीक महसूस होने पर भी अपने आप दवा बंद न करें',
      prescriptionRecommendation4: '❓ अगर दवा कैसे लेनी है इसमें कोई संदेह हो तो अपने डॉक्टर या फार्मासिस्ट से पूछें',
      genericPoint1: 'मेडिकल दस्तावेज़ सफलतापूर्वक निकाला और प्रोसेस किया गया',
      genericPoint2: 'दस्तावेज़ में स्वास्थ्य-संबंधित जानकारी मौजूद है',
      genericRecommendation1: 'इस रिपोर्ट की विस्तृत व्याख्या के लिए अपने डॉक्टर से सलाह लें',
      genericRecommendation2: 'इस रिपोर्ट को अपने मेडिकल रिकॉर्ड में सुरक्षित रखें',
      reportAboutPrefix: 'यह रिपोर्ट किस बारे में है:',
      reportActionPrefix: 'अब आपको क्या करना चाहिए:',
      urgencyImmediate: 'यदि तेज सीने में दर्द, सांस लेने में परेशानी, बेहोशी, भ्रम या तेज बुखार हो तो तुरंत इमरजेंसी मदद लें।',
      urgencyRoutine: 'रूटीन डॉक्टर फॉलो-अप बुक करें और अंतिम सलाह के लिए यह रिपोर्ट साथ ले जाएं।',
    },
    gujarati: {
      nonMedicalSummary: 'આ દસ્તાવેજ મેડિકલ રિપોર્ટ અથવા પ્રિસ્ક્રિપ્શન જેવો લાગતો નથી. કૃપા કરીને લેબ રિપોર્ટ, પ્રિસ્ક્રિપ્શન અથવા ક્લિનિકલ નોંધો જેવી માન્ય મેડિકલ ફાઇલ અપલોડ કરો.',
      nonMedicalPoint: 'અપલોડ કરેલી ફાઇલમાં મેડિકલ સામગ્રી મળી નથી',
      nonMedicalRecommendation: 'કૃપા કરીને માન્ય મેડિકલ દસ્તાવેજ અપલોડ કરો (લેબ રિપોર્ટ, પ્રિસ્ક્રિપ્શન, ટેસ્ટ પરિણામો વગેરે).',
      prescriptionSummary: 'આ તમારા ડૉક્ટરનું પ્રિસ્ક્રિપ્શન છે જેમાં તમારી બીમારી માટે દવાઓ લખેલી છે. પ્રિસ્ક્રિપ્શન પર લખેલી બધી વાતોને ધ્યાનથી ફોલો કરો.',
      prescriptionPoint1: '💊 આ દસ્તાવેજમાં તમારા ડૉક્ટરની લખેલી દવાઓ છે',
      prescriptionPoint2: '📝 બરાબર જેમ લખ્યું છે તેમ લો - માત્રા, સમય અને અવધિ જુઓ',
      prescriptionPoint3: '⏰ પ્રિસ્ક્રિપ્શનમાં લખેલા સમયે દવા લો',
      prescriptionRecommendation1: '✅ પ્રિસ્ક્રિપ્શન ધ્યાનથી વાંચો - જુઓ કે કઈ દવા ખોરાક સાથે કે ખાલી પેટે લેવાની છે',
      prescriptionRecommendation2: '⚠️ જો કોઈ અસામાન્ય લક્ષણ અથવા સાઇડ ઇફેક્ટ થાય તો તરત જ ડૉક્ટરનો સંપર્ક કરો',
      prescriptionRecommendation3: '🚫 સંપૂર્ણ કોર્સ પૂરો કરો - સારું લાગે તોપણ પોતાની મરજીથી દવા બંધ ન કરો',
      prescriptionRecommendation4: '❓ જો દવા કેવી રીતે લેવી તેમાં કોઈ શંકા હોય તો તમારા ડૉક્ટર અથવા ફાર્માસિસ્ટને પૂછો',
      genericPoint1: 'મેડિકલ દસ્તાવેજ સફળતાપૂર્વક કાઢી અને પ્રોસેસ કરવામાં આવ્યો',
      genericPoint2: 'દસ્તાવેજમાં આરોગ્ય સંબંધિત માહિતી હાજર છે',
      genericRecommendation1: 'આ રિપોર્ટની વિગતવાર સમજ માટે તમારા ડૉક્ટરની સલાહ લો',
      genericRecommendation2: 'આ રિપોર્ટને તમારા મેડિકલ રેકોર્ડમાં સાચવો',
      reportAboutPrefix: 'આ રિપોર્ટ શું વિશે છે:',
      reportActionPrefix: 'હવે તમને શું કરવું જોઈએ:',
      urgencyImmediate: 'જો ભારે છાતીમાં દુખાવો, શ્વાસમાં તકલીફ, બેહોશી, ગભરાટ અથવા ઊંચો તાવ હોય તો તરત ઇમર્જન્સી મદદ લો.',
      urgencyRoutine: 'રૂટીન ડૉક્ટર ફોલો-અપ બુક કરો અને અંતિમ સલાહ માટે આ રિપોર્ટ સાથે લઈ જાઓ.',
    },
  };

  const t = localized[lang] || localized.english;

  // ── Non-medical document detection ──
  const medicalKeywords = [
    'patient', 'doctor', 'diagnosis', 'prescription', 'medication', 'dosage',
    'treatment', 'symptom', 'blood', 'glucose', 'hemoglobin', 'cholesterol',
    'creatinine', 'thyroid', 'tsh', 'blood pressure', 'bp', 'infection',
    'xray', 'x-ray', 'ct scan', 'mri', 'ultrasound', 'lab', 'test result',
    'hospital', 'clinic', 'physician', 'nurse', 'surgery', 'biopsy',
    'report', 'pathology', 'radiology', 'ecg', 'ekg', 'urine', 'serum',
    'platelet', 'wbc', 'rbc', 'hba1c', 'glucose', 'ldl', 'hdl',
    'triglyceride', 'urea', 'kidney', 'liver', 'cardiac', 'pulmonary',
    'mg', 'ml', 'units', 'mmhg', 'normal range', 'reference range',
    'antibiotic', 'analgesic', 'tablet', 'capsule', 'injection', 'syrup',
    'frequency', 'twice', 'thrice', 'daily', 'bedtime', 'after meals',
    // Hindi
    'मरीज', 'रोगी', 'डॉक्टर', 'निदान', 'दवा', 'मेडिकल', 'रिपोर्ट', 'रक्त', 'जांच', 'उपचार',
    // Gujarati
    'દર્દી', 'ડૉક્ટર', 'નિદાન', 'દવા', 'મેડિકલ', 'રિપોર્ટ', 'લોહી', 'ટેસ્ટ', 'ઉપચાર',
  ];
  const hasMedicalKeyword = medicalKeywords.some((kw) => lower.includes(kw));
  const hasMedicalUnits = /(\d+\s?(mg|ml|mmhg|bpm|g\/dl|mmol|iu|mcg))/i.test(text);
  const hasLabPattern = /(hb|wbc|rbc|tsh|hba1c|ldl|hdl|creatinine|urea|platelet)/i.test(lower);
  const hasMedicalContent = hasMedicalKeyword || hasMedicalUnits || hasLabPattern;
  if (!hasMedicalContent) {
    return {
      summary: t.nonMedicalSummary,
      keyPoints: [`⚠️ ${t.nonMedicalPoint}`],
      recommendations: [t.nonMedicalRecommendation],
    };
  }

  const keyPoints = [];
  const recommendations = [];

  // If it's a prescription, return prescription-specific messages in the selected language
  if (isPrescription) {
    return buildDetailedPrescriptionLaymanAnalysis(text, lang);
  }

  if (lower.includes('glucose') || lower.includes('sugar') || lower.includes('hba1c')) {
    keyPoints.push('Blood sugar tests are present. This checks diabetes risk or sugar control over time.');
    recommendations.push('Reduce sugary foods, stay active, and review these values with your doctor.');
  }
  if (lower.includes('hemoglobin') || lower.includes('haemoglobin') || lower.includes('hb ')) {
    keyPoints.push('Hemoglobin value is present. This helps assess anemia and oxygen-carrying capacity of blood.');
    recommendations.push('Include iron/protein-rich foods and discuss low or very high values with your doctor.');
  }
  if (lower.includes('cholesterol') || lower.includes('ldl') || lower.includes('hdl') || lower.includes('triglyceride')) {
    keyPoints.push('Cholesterol/lipid profile is included. This relates to heart and blood vessel risk.');
    recommendations.push('Follow a low-oil diet, regular exercise plan, and review risk with your doctor.');
  }
  if (lower.includes('creatinine') || lower.includes('urea') || lower.includes('kidney')) {
    keyPoints.push('Kidney function markers are present. These show how well kidneys filter blood.');
    recommendations.push('Stay hydrated and consult your doctor if values are outside the reference range.');
  }
  if (lower.includes('thyroid') || lower.includes('tsh') || lower.includes('t3') || lower.includes('t4')) {
    keyPoints.push('Thyroid hormone tests are present. These affect energy, weight, mood, and metabolism.');
    recommendations.push('Do follow-up thyroid testing as advised and review medicine need with your doctor.');
  }
  if (lower.includes('blood pressure') || lower.includes('bp ') || lower.includes('hypertension') || lower.includes('mmhg')) {
    keyPoints.push('Blood pressure information is present. This helps evaluate hypertension risk.');
    recommendations.push('Track BP at home, reduce salt, and consult your doctor for target BP levels.');
  }
  if (lower.includes('xray') || lower.includes('x-ray') || lower.includes('ct scan') || lower.includes('mri') || lower.includes('ultrasound')) {
    keyPoints.push('Imaging report detected (X-ray/CT/MRI/Ultrasound). This looks at organs/structures, not just blood values.');
    recommendations.push('Show this scan report to your treating doctor for final clinical correlation.');
  }
  if (lower.includes('infection') || lower.includes('bacteria') || lower.includes('virus') || lower.includes('wbc') || lower.includes('white blood')) {
    keyPoints.push('Infection-related markers are present. This may indicate active inflammation or infection response.');
    recommendations.push('If symptoms worsen (high fever, weakness, breathing issues), seek medical care quickly.');
  }

  if (keyPoints.length === 0) {
    keyPoints.push(t.genericPoint1);
    keyPoints.push(t.genericPoint2);
    recommendations.push(t.genericRecommendation1);
    recommendations.push(t.genericRecommendation2);
  }

  const kind = lower.includes('lab') || lower.includes('test')
    ? (lang === 'hindi' ? 'लैब टेस्ट परिणाम' : lang === 'gujarati' ? 'લેબ ટેસ્ટ પરિણામો' : 'laboratory test results')
    : lower.includes('prescription')
      ? (lang === 'hindi' ? 'प्रिस्क्रिप्शन विवरण' : lang === 'gujarati' ? 'પ્રિસ્ક્રિપ્શન વિગતો' : 'prescription details')
      : (lang === 'hindi' ? 'मेडिकल जानकारी' : lang === 'gujarati' ? 'મેડિકલ માહિતી' : 'medical information');

  const hasEmergencyFlag = /(critical|panic|severe|very high|very low|urgent|acute|emergency)/i.test(lower);
  const whatAbout = lang === 'hindi'
    ? `${t.reportAboutPrefix} ${kind}.`
    : lang === 'gujarati'
      ? `${t.reportAboutPrefix} ${kind}.`
      : `${t.reportAboutPrefix} This report contains ${kind}.`;
  const whatToDo = hasEmergencyFlag ? t.urgencyImmediate : t.urgencyRoutine;

  let summary = '';
  if (lang === 'gujarati') {
    summary = `${whatAbout} મુખ્ય માહિતીનું સરળ ભાષામાં વિશ્લેષણ કર્યું છે. ${t.reportActionPrefix} ${whatToDo}`;
  } else if (lang === 'hindi') {
    summary = `${whatAbout} रिपोर्ट की मुख्य बातों को आसान भाषा में समझाया गया है। ${t.reportActionPrefix} ${whatToDo}`;
  } else {
    summary = `${whatAbout} Main findings are explained in simple language. ${t.reportActionPrefix} ${whatToDo}`;
  }

  if (!recommendations.includes(whatToDo)) {
    recommendations.unshift(whatToDo);
  }

  return { summary, keyPoints, recommendations };
};

// Configure multer for file uploads
const upload = multer({
  dest: path.join(__dirname, '../../uploads/reports/'),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  },
});

/**
 * POST /ai/summarize
 * Summarize a prescription using Gemini
 */
router.post('/summarize', protect, async (req, res) => {
  let type;
  let content;
  let language = 'english';
  let detailedMode = false;
  try {
    ({ type, content, language, detailedMode = false } = req.body || {});

    // Normalize language parameter: ensure it's lowercase and valid
    language = language ? String(language).toLowerCase().trim() : 'english';
    if (!['gujarati', 'hindi', 'english'].includes(language)) {
      language = 'english';
    }

    if (!content || !type) {
      return res.status(400).json({ error: 'Missing content or type' });
    }

    if (!hasGeminiKey()) {
      // No key configured — silently use rule-based fallback
      console.warn('[Gemini] No key — using rule-based summarize fallback');
      const fallback = type === 'prescription'
        ? ruleBasedPrescriptionSummary(content, language)
        : ruleBasedAnalysis(content, language);
      return res.json({
        summary: fallback.summary || '',
        keyPoints: fallback.keyPoints || [],
        recommendations: fallback.recommendations || [],
        detailedInstructions: fallback.detailedInstructions || '',
        sideEffects: fallback.sideEffects || [],
        precautions: fallback.precautions || [],
        aiPowered: false,
        language,
        aiWarning: '⚠️ AI not configured. Showing rule-based analysis.',
      });
    }

    // PROMPT #87-#88: Enhanced language instructions for better layman explanations
    const languageInstruction = language === 'hindi' 
      ? `IMPORTANT: Write ALL text in Hindi (हिंदी) language only. Use Devanagari script.
         - Use EVERYDAY WORDS that a farmer or factory worker would understand
         - TRANSLATE medical terms to body/health impact:
           * "Hypertension" = "खून का दबाव ज्यादा है" (blood pressure is high)
           * "Hyperglycemia" = "शरीर में शक्कर ज्यादा है" (too much sugar in body)
         - Explain medication effects in daily life impact, not chemical action
         - For EACH medicine, explain: (1) What it treats, (2) How body benefits, (3) When to expect improvement`
      : language === 'gujarati'
      ? `IMPORTANT: Write ALL text in Gujarati (ગુજરાતી) language only. Use Gujarati script.
         - Use EVERYDAY WORDS that a farmer or factory worker would understand
         - TRANSLATE medical terms to body/health impact clearly
         - Explain medication effects in daily life impact, not chemical action
         - For EACH medicine, explain: (1) What it treats, (2) How body benefits, (3) When to expect improvement`
      : `Write ALL text in simple English that a non-medical person can easily understand.
         - Avoid complex medical jargon or explain any necessary medical terms in parentheses
         - Use "your body," "your blood," etc. to make it personal
         - Explain medication benefits in what the patient will FEEL or SEE, not chemical action
         - For each medicine, explain: (1) What condition it treats, (2) How it helps your body, (3) When you'll likely feel better`;
    const prescriptionPrompt = detailedMode ? `
You are a compassionate medical assistant helping patients understand their prescriptions.
${languageInstruction}

Analyze this prescription and provide a comprehensive, patient-friendly explanation. Write in simple, everyday language.

1. Summary (2-3 sentences): Explain what condition is being treated and why these medicines are prescribed.

2. Detailed Instructions: For EACH medicine, write it as a separate step in this EXACT format:

Step 1: [Medicine Name] ([Dosage]): [When to take] [How to take] [For how long]

Example:
Step 1: Paracetamol 500mg (2 tablets): Take twice daily after breakfast and dinner with water for 5 days
Step 2: Amoxicillin 250mg (1 capsule): Take three times daily before meals with a full glass of water for 7 days

Keep each step simple and on ONE line with clear instructions.

3. Medication Details: List each medicine with its purpose in bullet points

4. Side Effects (3-5 for each medicine if AI-powered): What symptoms might occur and which require calling the doctor

5. Precautions (4-6 important warnings if AI-powered): What to avoid, when to contact doctor, storage

6. Recommendations (2-3 helpful tips): Follow-up reminders and lifestyle advice

IMPORTANT: Write in ${language === 'hindi' ? 'Hindi (हिंदी)' : language === 'gujarati' ? 'Gujarati (ગુજરાતી)' : 'simple English'}. Make detailed instructions easy to scan with numbered steps.

Format as JSON:
{
  "summary": "...",
  "detailedInstructions": "Step 1: ...\n\nStep 2: ...",
  "keyPoints": ["...", "..."],
  "sideEffects": ["...", "..."],
  "precautions": ["...", "..."],
  "recommendations": ["...", "..."]
}
` : `
You are a friendly medical assistant helping patients understand their prescriptions.
${languageInstruction}

Please analyze the following prescription and provide a clear, patient-friendly summary:
1. A 2-3 sentence summary explaining what the prescription is for
2. Key points: for each medication, explain when and how to take it (e.g., "Take Paracetamol 500mg twice daily after meals for 5 days")
3. Important recommendations: follow-up advice, storage instructions, or warnings

Format your response as JSON:
{
  "summary": "...",
  "keyPoints": ["...", "..."],
  "recommendations": ["...", "..."]
}
`;

    const reportPrompt = detailedMode ? `
You are a compassionate healthcare educator helping patients understand their medical reports.
${languageInstruction}

Imagine explaining this to a family member with NO medical background. Use everyday language they can understand.

Analyze this ${type} and provide:

1. Summary (4-5 simple sentences):
   - What test was done and why? (in plain words)
   - What are the main results?
   - Are the results good, concerning, or need attention?
   - What should the patient know right away?

2. Detailed Instructions (Write as numbered steps):

Step 1: [First action to take - be specific]
Step 2: [Second action - what to do next]
Step 3: [Continue with clear steps]

Example:
Step 1: Book a follow-up appointment with your doctor within 1 week to discuss these results
Step 2: Start drinking 8-10 glasses of water daily to help your kidneys work better
Step 3: Reduce salt in your diet - avoid adding extra salt to food
Step 4: Monitor your blood pressure at home twice daily and write it down

Make each step actionable and easy to follow.

3. Key Findings (Explain EACH important result simply):
   For each test result, explain:
   - What was measured
   - Your result in simple terms (is it normal? high? low?)
   - Why this matters for your health
   - What it means in everyday language

4. Possible Concerns (3-5 points):
   - What symptoms might these results explain?
   - What health problems could this indicate?
   - Which issues need quick attention?
   Use plain language: instead of "hypertension", say "high blood pressure"

5. Important Precautions (4-6 warnings):
   - Warning signs that mean "go to doctor NOW"
   - Things to avoid (foods, activities)
   - Lifestyle changes to make
   - When to check back with your doctor

6. Health Recommendations (4-5 practical tips):
   - Specific diet advice (what to eat MORE, what to eat LESS)
   - Exercise suggestions (how much, what type)
   - Medicine reminders
   - Follow-up test schedule
   - Daily habits to improve health

IMPORTANT: Write EVERYTHING in ${language === 'hindi' ? 'Hindi (हिंदी)' : language === 'gujarati' ? 'Gujarati (ગુજરાતી)' : 'simple, conversational English'}.

Think: "How would I explain this to my grandmother?" Be warm, clear, and reassuring.

Format as JSON:
{
  "summary": "...",
  "detailedInstructions": "Step 1: ...\n\nStep 2: ...",
  "keyPoints": ["...", "..."],
  "sideEffects": ["...", "..."],
  "precautions": ["...", "..."],
  "recommendations": ["...", "..."]
}
` : `
You are a practical medical report explainer helping patients understand their results.
${languageInstruction}

Make this report easy to understand for someone with NO medical training.

Analyze this ${type} and provide:

1. Summary (4-5 simple sentences that answer):
   - What was tested?
   - What do the results show? (good news or concern?)
   - What should I do right now?
   - When should I see my doctor?

2. Key Findings (3-5 points in plain language):
   - Avoid medical jargon
   - Explain what each important finding means for daily life
   - Say if it's normal, needs attention, or urgent
   Example: "Your blood sugar is 180 (high) - normal is under 140. This means your body isn't controlling sugar well."

3. Recommendations (4-5 actionable steps):
   - WHEN to follow up ("within 3 days", "next week")
   - WHAT to do daily (diet, exercise, habits)
   - WARNING SIGNS to watch for (when to call doctor immediately)
   - LIFESTYLE changes (be specific: "walk 30 minutes daily", not just "exercise more")

Remember: Speak like a caring friend, not a textbook. Make it practical and useful!

Format your response as JSON:
{
  "summary": "...",
  "keyPoints": ["...", "..."],
  "recommendations": ["...", "..."]
}
`;

    const prompt = (type === 'prescription' ? prescriptionPrompt : reportPrompt) + `\nContent to analyze:\n${content}`;

    const jsonResponse = await generateJsonWithGemini(prompt);
    if ((language === 'hindi' || language === 'gujarati') && isEnglishOnlyText(jsonResponse?.summary || '')) {
      return res.status(502).json({
        error: 'AI response language mismatch. Please retry.',
      });
    }

    const response = {
      summary: jsonResponse?.summary || '',
      keyPoints: Array.isArray(jsonResponse?.keyPoints) ? jsonResponse.keyPoints : [],
      recommendations: Array.isArray(jsonResponse?.recommendations) ? jsonResponse.recommendations : [],
      detailedInstructions: jsonResponse?.detailedInstructions || '',
      sideEffects: Array.isArray(jsonResponse?.sideEffects) ? jsonResponse.sideEffects : [],
      precautions: Array.isArray(jsonResponse?.precautions) ? jsonResponse.precautions : [],
      aiPowered: true,
      language,
    };

    const genericSummaryPatterns = [
      'your medical document has been analyzed',
      'please review the details below',
      'summary was generated',
    ];

    const looksGeneric = genericSummaryPatterns.some((p) =>
      String(response.summary || '').toLowerCase().includes(p)
    );

    if (!response.summary || looksGeneric) {
      return res.status(502).json({
        error: 'AI returned low-quality generic output. Please retry.',
      });
    }

    res.json(response);
  } catch (error) {
    // Any Gemini/network failure — fall back to rule-based instead of crashing
    console.warn('[Gemini] /summarize error, using rule-based fallback:', error.message);
    try {
      const fallback = type === 'prescription'
        ? ruleBasedPrescriptionSummary(content, language)
        : ruleBasedAnalysis(content, language);
      return res.json({
        summary: fallback.summary || '',
        keyPoints: fallback.keyPoints || [],
        recommendations: fallback.recommendations || [],
        detailedInstructions: fallback.detailedInstructions || '',
        sideEffects: fallback.sideEffects || [],
        precautions: fallback.precautions || [],
        aiPowered: false,
        language,
        aiWarning: '⚠️ AI unavailable. Showing rule-based analysis.',
      });
    } catch (fallbackErr) {
      return res.status(500).json({ error: 'Could not process document. Please try again.', message: error.message });
    }
  }
});

/**
 * POST /ai/analyze-report
 * Analyze a medical report text using Gemini
 */
const detectNonMedicalContent = (summary = '', keyPoints = []) => {
  const combined = `${String(summary || '')} ${(Array.isArray(keyPoints) ? keyPoints.join(' ') : '')}`.toLowerCase();
  return [
    'does not appear to be a medical',
    'no medical content detected',
    'non-medical document detected',
    'मेडिकल सामग्री नहीं मिली',
    'मेडिकल रिपोर्ट या प्रिस्क्रिप्शन जैसा नहीं',
    'મેડિકલ સામગ્રી મળી નથી',
    'મેડિકલ રિપોર્ટ અથવા પ્રિસ્ક્રિપ્શન જેવો લાગતો નથી'
  ].some((p) => combined.includes(p));
};

router.post('/analyze-report', protect, async (req, res) => {
  let language = 'english';
  try {
    const { type, content, language: requestLanguage = 'english', detailedMode = false } = req.body;
    language = String(requestLanguage || 'english').toLowerCase().trim();
    if (!['gujarati', 'hindi', 'english'].includes(language)) {
      language = 'english';
    }
    const normalizedContent = String(content || '');
    const lower = normalizedContent.toLowerCase();

    const looksLikePrescription = (lower.includes('prescription') || lower.includes('medications') || lower.includes('doctor') || lower.includes('dr')) &&
      (lower.includes('dosage') || lower.includes('frequency') || lower.includes('duration') || lower.includes('tablet') || lower.includes('medicine'));

    // If content is missing or too short, return explicit error instead of generic fallback
    if (!normalizedContent || normalizedContent.trim().length < 5) {
      return res.status(422).json({
        error: 'No readable medical content found. Please upload a clearer medical report.',
      });
    }

    const compactText = (value = '', maxSentences = 3) => {
      const sentences = String(value || '')
        .replace(/\s+/g, ' ')
        .split(/(?<=[.!?।॥])\s+/)
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, maxSentences);
      return sentences.join(' ').trim();
    };

    const compactArray = (items = [], maxItems = 5) => {
      return (Array.isArray(items) ? items : [])
        .map((x) => compactText(String(x || ''), 2))
        .filter(Boolean)
        .slice(0, maxItems);
    };

    const normalizeStepText = (value = '', lang = 'english') => {
      const text = String(value || '').trim();
      if (!text) return '';
      const chunks = text
        .split(/Step\s*\d+\s*:\s*|चरण\s*\d+\s*:\s*|પગલું\s*\d+\s*:\s*|\n+/i)
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 5);
      const stepWord = lang === 'hindi' ? 'चरण' : lang === 'gujarati' ? 'પગલું' : 'Step';
      return chunks.map((c, i) => `${stepWord} ${i + 1}: ${c}`).join('\n');
    };

    if (!hasGeminiKey()) {
      console.warn('[Gemini] No key — using rule-based analyze-report fallback');
      const fallback = ruleBasedAnalysis(normalizedContent, language);
      return res.json({
        summary: fallback.summary || '',
        keyPoints: fallback.keyPoints || [],
        recommendations: fallback.recommendations || [],
        detailedInstructions: fallback.detailedInstructions || '',
        sideEffects: fallback.sideEffects || [],
        precautions: fallback.precautions || [],
        aiPowered: false,
        detectedType: looksLikePrescription ? 'prescription' : 'report',
        isMedical: true,
        aiWarning: '⚠️ AI not configured. Showing rule-based analysis.',
      });
    }

    const languageInstruction = language === 'hindi' 
      ? 'IMPORTANT: Write ALL text in Hindi (हिंदी) language only. Use Devanagari script. Do not mix English words unless they are medical terms that must be clarified.'
      : language === 'gujarati'
      ? 'IMPORTANT: Write ALL text in Gujarati (ગુજરાતી) language only. Use Gujarati script. Do not mix English words unless they are medical terms that must be clarified.'
      : 'Write ALL text in simple English that a non-medical person can easily understand. Avoid complex medical jargon.';

    const prompt = looksLikePrescription ? `
You are explaining a doctor prescription to a patient in very simple language.
${languageInstruction}

Return ONLY valid JSON with fields:
{
  "summary": "short paragraph",
  "detailedInstructions": "Step 1: ...",
  "keyPoints": ["..."],
  "sideEffects": ["medicine-specific side effects"],
  "precautions": ["medicine-specific precautions"],
  "recommendations": ["what to do now"]
}

Keep output concise, practical, and medicine-specific (avoid generic template lines).

Prescription text:
${normalizedContent}
    ` : detailedMode ? `
You are a compassionate healthcare educator helping patients understand their medical reports.
${languageInstruction}

Imagine explaining this to a family member with NO medical background. Use everyday language they can understand.

Analyze this medical report and provide:

1. Summary (4-5 simple sentences):
   - What test was done and why? (in plain words)
   - What are the main results?
   - Are the results good, concerning, or need attention?
   - What should the patient know right away?

2. Detailed Instructions (Write as numbered steps):

Step 1: [First action to take - be specific]
Step 2: [Second action - what to do next]
Step 3: [Continue with clear steps]

Example:
Step 1: Book a follow-up appointment with your doctor within 1 week to discuss these results
Step 2: Start drinking 8-10 glasses of water daily to help your kidneys work better
Step 3: Reduce salt in your diet - avoid adding extra salt to food
Step 4: Monitor your blood pressure at home twice daily and write it down

Make each step actionable and easy to follow.

3. Key Findings (Explain EACH important result simply):
   For each test result, explain:
   - What was measured
   - Your result in simple terms (is it normal? high? low?)
   - Why this matters for your health
   - What it means in everyday language

4. Possible Concerns (3-5 points):
   - What symptoms might these results explain?
   - What health problems could this indicate?
   - Which issues need quick attention?
   Use plain language: instead of "hypertension", say "high blood pressure"

5. Important Precautions (4-6 warnings):
   - Warning signs that mean "go to doctor NOW"
   - Things to avoid (foods, activities)
   - Lifestyle changes to make
   - When to check back with your doctor

6. Health Recommendations (4-5 practical tips):
   - Specific diet advice (what to eat MORE, what to eat LESS)
   - Exercise suggestions (how much, what type)
   - Medicine reminders
   - Follow-up test schedule
   - Daily habits to improve health

IMPORTANT: Write EVERYTHING in ${language === 'hindi' ? 'Hindi (हिंदी)' : language === 'gujarati' ? 'Gujarati (ગુજરાતી)' : 'simple, conversational English'}.

Think: "How would I explain this to my grandmother?" Be warm, clear, and reassuring.

Format your response as JSON with this structure:
{
  "summary": "...",
  "detailedInstructions": "Step 1: ...\n\nStep 2: ...",
  "keyPoints": ["...", "..."],
  "sideEffects": ["...", "..."],
  "precautions": ["...", "..."],
  "recommendations": ["...", "..."]
}

Report content:
${normalizedContent}
    ` : `
You are a practical medical report explainer helping patients understand their results.
${languageInstruction}

Make this report easy to understand for someone with NO medical training.

Analyze this medical report and provide:

1. Summary (4-5 simple sentences that answer):
   - What was tested?
   - What do the results show? (good news or concern?)
   - What should I do right now?
   - When should I see my doctor?

2. Key Findings (3-5 points in plain language):
   - Avoid medical jargon
   - Explain what each important finding means for daily life
   - Say if it's normal, needs attention, or urgent
   Example: "Your blood sugar is 180 (high) - normal is under 140. This means your body isn't controlling sugar well."

3. Recommendations (4-5 actionable steps):
   - WHEN to follow up ("within 3 days", "next week")
   - WHAT to do daily (diet, exercise, habits)
   - WARNING SIGNS to watch for (when to call doctor immediately)
   - LIFESTYLE changes (be specific: "walk 30 minutes daily", not just "exercise more")

Remember: Speak like a caring friend, not a textbook. Make it practical and useful!

Format your response as JSON with this structure:
{
  "summary": "...",
  "keyPoints": ["...", "..."],
  "recommendations": ["...", "..."]
}

Report content:
${normalizedContent}
    `;

    const jsonResponse = await generateJsonWithGemini(prompt);

    const response = {
      summary: compactText(jsonResponse?.summary || '', 3),
      keyPoints: compactArray(jsonResponse?.keyPoints, 6),
      recommendations: compactArray(jsonResponse?.recommendations, 5),
      detailedInstructions: normalizeStepText(jsonResponse?.detailedInstructions || '', language),
      sideEffects: compactArray(jsonResponse?.sideEffects, 5),
      precautions: compactArray(jsonResponse?.precautions, 5),
      aiPowered: true,
      detectedType: looksLikePrescription ? 'prescription' : 'report',
    };

    const genericSummaryPatterns = [
      'your medical document has been analyzed',
      'please review the details below',
      'medical document processed',
      'review with your healthcare provider',
      'follow your doctor\'s advice',
      'keep this document for your records',
    ];

    const looksGeneric = genericSummaryPatterns.some((p) =>
      String(response.summary || '').toLowerCase().includes(p)
    );

    if (!response.summary || looksGeneric) {
      return res.status(502).json({
        error: 'AI returned low-quality generic output. Please retry.',
      });
    }

    res.json({ ...response, isMedical: !detectNonMedicalContent(response.summary, response.keyPoints) });
  } catch (error) {
    console.warn('[Gemini] /analyze-report error, using rule-based fallback:', error.message);
    try {
      const fallback = ruleBasedAnalysis(String(req.body?.content || ''), language);
      return res.json({
        summary: fallback.summary || '',
        keyPoints: fallback.keyPoints || [],
        recommendations: fallback.recommendations || [],
        detailedInstructions: fallback.detailedInstructions || '',
        sideEffects: fallback.sideEffects || [],
        precautions: fallback.precautions || [],
        aiPowered: false,
        isMedical: true,
        aiWarning: '⚠️ AI unavailable. Showing rule-based analysis.',
      });
    } catch (fallbackErr) {
      return res.status(500).json({ error: 'Failed to analyze report. Please try again.', message: error.message });
    }
  }
});

const isGarbledExtractedText = (text = '') => {
  const sample = String(text || '').replace(/\s+/g, ' ').trim();
  if (!sample) return true;

  const validMatches = sample.match(/[A-Za-z0-9\u0900-\u097F\u0A80-\u0AFF\s.,:;!?()\[\]\-/%₹'"&+]/g) || [];
  const validRatio = validMatches.length / sample.length;

  const mojibakeMatches = sample.match(/[†‡•…‰‹›€™œžŸ¡¢£¤¥¦§¨©ª«¬®¯°±²³´µ¶·¸¹º»¼½¾¿À-ÖØ-öø-ÿ]/g) || [];
  const mojibakeRatio = mojibakeMatches.length / sample.length;

  return validRatio < 0.55 || mojibakeRatio > 0.12;
};

/**
 * POST /ai/extract-text
 * Extract text from image using OCR
 */
router.post('/extract-text', protect, upload.single('file'), async (req, res) => {
  const uploadedPath = req.file?.path;
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    let extractedText = '';
    let confidence = 100;
    const requestedLanguage = String(req.body?.language || 'english').toLowerCase().trim();
    const tesseractLang = requestedLanguage === 'hindi' ? 'hin' : requestedLanguage === 'gujarati' ? 'guj' : 'eng';

    if (req.file.mimetype === 'application/pdf') {
      // Extract text from PDF using pdf-parse
      const dataBuffer = await fs.promises.readFile(req.file.path);
      const pdfData = await pdfParse(dataBuffer);
      extractedText = pdfData.text ? pdfData.text.trim() : '';

      if (!extractedText || extractedText.length < 20) {
        // Scanned/image-only PDF — no selectable text
        return res.status(422).json({
          error: 'This PDF appears to be a scanned document with no selectable text. Please export the report as a JPG or PNG image and upload that instead.',
        });
      }

      if (isGarbledExtractedText(extractedText)) {
        return res.status(422).json({
          error: 'Text extracted from this PDF appears encoded/corrupted. Please upload a clear JPG/PNG of the report or a searchable PDF for accurate analysis.',
        });
      }

      confidence = 99; // PDF text extraction is deterministic
    } else {
      // Use Tesseract.js for image OCR
      try {
        const result = await Tesseract.recognize(req.file.path, tesseractLang);
        extractedText = result.data.text;
        confidence = result.data.confidence;
      } catch (langError) {
        // Fallback to English OCR when selected traineddata is unavailable
        const fallbackResult = await Tesseract.recognize(req.file.path, 'eng');
        extractedText = fallbackResult.data.text;
        confidence = fallbackResult.data.confidence;
      }
    }

    // Delete uploaded file after processing
    await fs.promises.unlink(req.file.path).catch(() => {});

    res.json({
      text: extractedText,
      confidence,
    });
  } catch (error) {

    res.status(500).json({
      error: 'Failed to extract text',
      message: error.message,
    });
  } finally {
    if (uploadedPath) {
      fs.promises.unlink(uploadedPath).catch(() => {});
    }
  }
});

/**
 * POST /medical-history/upload-report
 * Upload medical report to server
 */
router.post('/upload-report', protect, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    // Save file info (in production, store in database)
    const fileName = `report_${Date.now()}_${req.file.originalname}`;

    res.json({
      success: true,
      fileName,
      fileSize: req.file.size,
      uploadedAt: new Date().toISOString(),
    });
  } catch (error) {

    res.status(500).json({
      error: 'Failed to upload report',
      message: error.message,
    });
  }
});

/**
 * POST /ai/analyze-medical-document
 * Comprehensive medical document OCR reader and analyzer
 * Accepts: IMAGE (JPG, PNG, WEBP) or PDF
 * Returns: Structured JSON with medical analysis
 */
router.post('/analyze-medical-document', protect, upload.single('file'), async (req, res) => {
  let uploadedPath = null;
  
  try {
    if (!req.file) {
      return res.status(400).json({ 
        status: 'error',
        message: 'No file provided' 
      });
    }

    uploadedPath = req.file.path;
    const inputType = req.file.mimetype === 'application/pdf' ? 'pdf' : 'image';
    let extractedText = '';

    // ═══════════════════════════════════════════════════════
    // 🔴 PHASE 1 — READ THE INPUT (IMAGE OR PDF)
    // ═══════════════════════════════════════════════════════


    if (inputType === 'pdf') {
      // Extract text from PDF
      const dataBuffer = await fs.promises.readFile(req.file.path);
      const pdfData = await pdfParse(dataBuffer);
      extractedText = pdfData.text ? pdfData.text.trim() : '';

    } else {
      // Use OCR for images
      try {
        const result = await Tesseract.recognize(req.file.path, 'eng');
        extractedText = result.data.text || '';

      } catch (ocrError) {

        extractedText = '';
      }
    }

    // ═══════════════════════════════════════════════════════
    // 🔴 PHASE 2 — VALIDATE READABILITY
    // ═══════════════════════════════════════════════════════
    if (!extractedText || extractedText.trim().length < 20) {
      await fs.promises.unlink(uploadedPath).catch(() => {});
      return res.json({
        status: 'ocr_failed',
        message: '❌ We could not read your document. Please upload a clearer photo, scan, or a non-password-protected PDF.'
      });
    }

    // ═══════════════════════════════════════════════════════
    // 🔴 PHASE 3 — VALIDATE IF MEDICAL DOCUMENT
    // ═══════════════════════════════════════════════════════
    const isMedical = validateMedicalContent(extractedText);
    
    if (!isMedical) {
      await fs.promises.unlink(uploadedPath).catch(() => {});
      return res.json({
        status: 'non_medical',
        message: '⚠️ This does not look like a medical document. Please upload a valid prescription or lab report.'
      });
    }

    // ═══════════════════════════════════════════════════════
    // 🟢 PHASE 4 — DETECT DOCUMENT TYPE
    // ═══════════════════════════════════════════════════════
    const documentType = detectDocumentType(extractedText);


    // ═══════════════════════════════════════════════════════
    // 🟢 PHASE 5 — AI ANALYSIS & JSON GENERATION
    // ═══════════════════════════════════════════════════════
    // 🟢 PHASE 5 — AI ANALYSIS (with automatic rule-based fallback)
    // ═══════════════════════════════════════════════════════
    let analysisResult;
    let aiPowered = false;
    let aiWarning = null;

    if (hasGeminiKey()) {
      try {
        analysisResult = await analyzeMedicalDocumentWithGemini(extractedText, documentType, inputType);
        aiPowered = true;
      } catch (aiError) {
        const msg = String(aiError?.message || '');
        const isRevoked = /403|leaked|revoked|permission/i.test(msg);
        const isQuota   = /429|quota/i.test(msg);
        const isBusy    = /503|service unavailable/i.test(msg);

        if (isRevoked) {
          aiWarning = '⚠️ AI analysis unavailable (API keys revoked). Showing rule-based analysis instead.';
          console.warn('[Gemini] All keys revoked — falling back to rule-based analysis');
        } else if (isQuota) {
          aiWarning = '⚠️ Tried all configured Gemini keys, but quota is exhausted for all of them. Showing rule-based analysis instead.';
          console.warn('[Gemini] Quota exceeded — falling back to rule-based analysis');
        } else if (isBusy) {
          aiWarning = '⚠️ AI is busy right now. Showing rule-based analysis instead.';
          console.warn('[Gemini] Service busy — falling back to rule-based analysis');
        } else {
          aiWarning = '⚠️ AI analysis unavailable. Showing rule-based analysis instead.';
          console.warn('[Gemini] Error — falling back to rule-based analysis:', msg);
        }

        // Graceful fallback — never crash the upload
        analysisResult = analyzeMedicalDocumentRuleBased(extractedText, documentType, inputType);
        aiPowered = false;
      }
    } else {
      // No keys configured at all — use rule-based silently
      console.warn('[Gemini] No API key configured — using rule-based analysis');
      aiWarning = '⚠️ AI not configured. Showing rule-based analysis instead.';
      analysisResult = analyzeMedicalDocumentRuleBased(extractedText, documentType, inputType);
      aiPowered = false;
    }

    // Clean up uploaded file
    await fs.promises.unlink(uploadedPath).catch(() => {});

    // Ensure status is set even if Gemini omitted it
    const finalResult = {
      status: 'success',
      ...(analysisResult || {}),
      aiPowered,
      ...(aiWarning ? { aiWarning } : {}),
    };

    res.json(finalResult);

  } catch (error) {
    if (uploadedPath) {
      await fs.promises.unlink(uploadedPath).catch(() => {});
    }
    const msg = String(error?.message || '');
    res.status(500).json({
      status: 'error',
      message: msg.includes('key missing') || msg.includes('Gemini')
        ? '⚠️ Gemini is not configured correctly. Check GEMINI_API_KEY in backend .env'
        : 'An error occurred while processing your document. Please try again.',
    });
  }
});

// ═══════════════════════════════════════════════════════
// HELPER FUNCTIONS FOR MEDICAL DOCUMENT ANALYSIS
// ═══════════════════════════════════════════════════════

/**
 * Validate if text contains medical content
 */
function validateMedicalContent(text) {
  const lowerText = String(text || '').toLowerCase();
  const strongMedicalKeywords = [
    'prescription', 'diagnosis', 'medication', 'dosage', 'tablet', 'capsule', 'syrup', 'injection',
    'blood pressure', 'hemoglobin', 'glucose', 'cholesterol', 'creatinine', 'platelet', 'wbc', 'rbc',
    'x-ray', 'mri', 'ct scan', 'ultrasound', 'radiology',
    'मरीज', 'डॉक्टर', 'दवा', 'निदान', 'जांच',
    'દર્દી', 'ડૉક્ટર', 'દવા', 'નિદાન', 'ટેસ્ટ'
  ];
  const weakMedicalKeywords = [
    'patient', 'doctor', 'hospital', 'clinic', 'lab', 'report', 'medical', 'health', 'test', 'findings', 'impression'
  ];

  const strongMatches = strongMedicalKeywords.filter((keyword) => lowerText.includes(keyword)).length;
  const weakMatches = weakMedicalKeywords.filter((keyword) => lowerText.includes(keyword)).length;
  const hasMedicalUnits = /(\d+\s?(mg|ml|mmhg|bpm|g\/dl|mmol|mcg|iu))/i.test(lowerText);
  const hasPrescriptionPattern = /(rx\b|dosage|frequency|duration|tablet|capsule|take\s+once|take\s+twice)/i.test(lowerText);

  // Reject obvious technical/non-medical documents early
  const technicalNonMedicalPattern = /(\bdocument object model\b|\bdom\b.*\btable\b|\bdom summary\b|\bhtml element\b|\bjavascript\b|\bjsdom\b|\breact\b.*\bcomponent\b|\bnode\.js\b|\btypescript\b|\bwebpack\b|\bvite\b|\bapi endpoint\b|\bhttp request\b|\bconsole\.log\b|\binner html\b|\bquery selector\b|\bdocument\.get|\bdom tree\b|\bdom node\b|\bdom manipulation\b)/i;
  if (technicalNonMedicalPattern.test(lowerText) && strongMatches === 0 && !hasMedicalUnits) {
    return false;
  }

  return strongMatches >= 1 || hasMedicalUnits || hasPrescriptionPattern || weakMatches >= 4;
}

/**
 * Detect document type based on content
 */
function detectDocumentType(text) {
  const lowerText = text.toLowerCase();
  
  // Check for prescription indicators
  if (lowerText.includes('rx') || lowerText.includes('prescription') || 
      (lowerText.includes('medication') && lowerText.includes('dosage'))) {
    return 'prescription';
  }
  
  // Check for lab report indicators
  if (lowerText.includes('lab') || lowerText.includes('test result') ||
      lowerText.includes('reference range') || lowerText.includes('normal range')) {
    return 'lab_report';
  }
  
  // Check for radiology report indicators
  if (lowerText.includes('x-ray') || lowerText.includes('mri') || 
      lowerText.includes('ct scan') || lowerText.includes('ultrasound') ||
      lowerText.includes('radiology') || lowerText.includes('imaging')) {
    return 'radiology_report';
  }
  
  // Check for discharge summary indicators
  if (lowerText.includes('discharge') || lowerText.includes('admission') ||
      lowerText.includes('admitted') || lowerText.includes('discharged')) {
    return 'discharge_summary';
  }
  
  // Default to prescription if unclear
  return 'prescription';
}

/**
 * Analyze medical document using Gemini
 */
async function analyzeMedicalDocumentWithGemini(extractedText, documentType, inputType) {
  // Truncate to ~6000 chars to stay within Gemini input token limits while preserving detail
  const safeText = String(extractedText || '').slice(0, 6000);

  const systemPrompt = `You are a medical document OCR reader and analyzer. You receive extracted text from medical documents and return structured JSON analysis.

CRITICAL RULES:
1. Return ONLY valid JSON - no markdown, no backticks, no text outside JSON
2. Never skip any field - use "Not mentioned" for missing data, [] for empty arrays
3. Never invent data not present in the document
4. For medicines, provide detailed side effects (min 4-5), timing with meal references, what to avoid
5. For lab results, explain what values mean and what to do
6. All lifestyle, emergency_signs, findings must be arrays of icon-prefixed points
7. summary.overview_points must be array of 8-10 single-line points with icons`;

  const userPrompt = `Analyze this ${documentType} document and return the exact JSON structure specified.

EXTRACTED TEXT:
${safeText}

Return a comprehensive JSON object with these exact fields:
- status: "success"
- input_type: "${inputType}"
- document_type: "${documentType}"
- ocr_extracted_text: "(include first 500 chars of extracted text here)"
- overview: {hospital_or_lab, doctor_name, patient_name, patient_age, date, diagnosis}
- medicines: [] (array of detailed medicine objects with name, generic_name, what_it_does, dosage, frequency, timing array, take_with, duration, side_effects array, what_to_avoid array, important_tip)
- lab_results: [] (array with test_name, your_value, normal_range, status, status_emoji, what_it_means array, what_to_do array)
- radiology_findings: {scan_type, findings array, impression, what_to_do array}
- alerts: [] (array with level, emoji, title, description, action)
- lifestyle: {diet array, exercise array, hydration array, sleep array, avoid array}
- followup: {next_visit, repeat_tests array, emergency_signs array (min 5)}
- summary: {overview_points array (8-10 points)}
- disclaimer: "⚕️ This analysis is AI-generated for informational purposes only. Always consult your doctor or pharmacist before making any medical decisions."

Remember: Use emojis, make it patient-friendly, arrays for all lists, never paragraphs.`;

  const aiResponse = await generateJsonWithGemini(`${systemPrompt}\n\n${userPrompt}`);
  return aiResponse;
}

/**
 * Rule-based analysis when AI is unavailable
 */
function analyzeMedicalDocumentRuleBased(extractedText, documentType, inputType) {
  // Extract basic information from text
  const overview = extractOverview(extractedText);
  const medicines = documentType === 'prescription' ? extractMedicines(extractedText) : [];
  const labResults = documentType === 'lab_report' ? extractLabResults(extractedText) : [];
  const diagnosisText = String(overview.diagnosis || '').trim();
  const medicineCount = Array.isArray(medicines) ? medicines.length : 0;
  const labCount = Array.isArray(labResults) ? labResults.length : 0;

  const summaryLead = documentType === 'prescription'
    ? (diagnosisText
        ? `🩺 This appears to be a prescription for ${diagnosisText}.`
        : '🩺 This appears to be a doctor prescription document.')
    : documentType === 'lab_report'
      ? `🧪 This appears to be a lab report with ${labCount || 'multiple'} measurable test result${labCount === 1 ? '' : 's'}.`
      : documentType === 'radiology_report'
        ? '🩻 This appears to be a radiology/imaging report.'
        : '🩺 This appears to be a medical document.';

  const summaryPoints = [
    summaryLead,
    medicineCount > 0
      ? `💊 Detected ${medicineCount} medicine entr${medicineCount === 1 ? 'y' : 'ies'} from the document text.`
      : null,
    labCount > 0
      ? `📊 Detected ${labCount} lab value entr${labCount === 1 ? 'y' : 'ies'} to review with your doctor.`
      : null,
    '🧪 Track any test results and share with your doctor',
    '⚠️ Watch for any unusual symptoms or side effects',
    '🥗 Maintain a healthy diet and lifestyle',
    '🏃 Stay physically active as recommended',
    '📅 Schedule follow-up appointments as advised',
    '🚨 Seek emergency care if you experience severe symptoms',
  ].filter(Boolean);
  
  return {
    status: 'success',
    input_type: inputType,
    document_type: documentType,
    ocr_extracted_text: extractedText,
    
    overview: {
      hospital_or_lab: overview.hospital || 'Not mentioned',
      doctor_name: overview.doctor || 'Not mentioned',
      patient_name: overview.patient || 'Not mentioned',
      patient_age: overview.age || 'Not mentioned',
      date: overview.date || 'Not mentioned',
      diagnosis: overview.diagnosis || 'Not mentioned in document'
    },
    
    medicines: medicines,
    lab_results: labResults,
    
    radiology_findings: {
      scan_type: documentType === 'radiology_report' ? 'Imaging study' : 'Not applicable',
      findings: documentType === 'radiology_report' ? ['🔬 Findings extracted from document'] : [],
      impression: documentType === 'radiology_report' ? 'See findings above' : 'Not applicable',
      what_to_do: documentType === 'radiology_report' ? ['👨‍⚕️ Consult your doctor to discuss these findings'] : []
    },
    
    alerts: [],
    
    lifestyle: {
      diet: [
        '✅ Eat: balanced diet with fruits and vegetables',
        '❌ Avoid: excessive sugar and processed foods'
      ],
      exercise: [
        '🏃 Regular physical activity recommended',
        '🚫 Avoid overexertion until fully recovered'
      ],
      hydration: [
        '💧 Drink 8-10 glasses of water daily'
      ],
      sleep: [
        '😴 Get 7-8 hours of sleep every night'
      ],
      avoid: [
        '🚭 No smoking',
        '🍺 Limit alcohol consumption'
      ]
    },
    
    followup: {
      next_visit: '📅 Follow up with your doctor as recommended',
      repeat_tests: [],
      emergency_signs: [
        '🚨 Difficulty breathing or chest pain — go to emergency immediately',
        '🌡️ High fever above 103°F — visit doctor urgently',
        '😵 Severe dizziness or fainting — seek immediate medical help',
        '💊 Severe allergic reaction (swelling, rash) — emergency',
        '😶 Extreme weakness or confusion — call emergency services'
      ]
    },
    
    summary: {
      overview_points: summaryPoints
    },
    
    disclaimer: '⚕️ This analysis is AI-generated for informational purposes only. Always consult your doctor or pharmacist before making any medical decisions.'
  };
}

/**
 * Extract overview information from text
 */
function extractOverview(text) {
  const overview = {
    hospital: null,
    doctor: null,
    patient: null,
    age: null,
    date: null,
    diagnosis: null
  };
  
  const lines = text.split('\n');
  
  for (const line of lines) {
    const lower = line.toLowerCase();
    
    // Extract hospital/clinic name
    if ((lower.includes('hospital') || lower.includes('clinic') || lower.includes('lab')) && !overview.hospital) {
      overview.hospital = line.trim();
    }
    
    // Extract doctor name
    if ((lower.includes('dr.') || lower.includes('doctor')) && !overview.doctor) {
      overview.doctor = line.replace(/doctor/gi, '').replace(/dr\./gi, '').trim();
    }
    
    // Extract patient name
    if ((lower.includes('patient') || lower.includes('name')) && lower.includes(':') && !overview.patient) {
      const match = line.match(/(?:patient|name)\s*:?\s*(.+)/i);
      if (match) overview.patient = match[1].trim();
    }
    
    // Extract age
    if ((lower.includes('age') || lower.match(/\d+\s*(?:years|yrs|y)/)) && !overview.age) {
      const ageMatch = line.match(/(\d+)\s*(?:years|yrs|y|age)/i);
      if (ageMatch) overview.age = ageMatch[1] + ' years';
    }
    
    // Extract date
    if (!overview.date && line.match(/\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/)) {
      const dateMatch = line.match(/\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/);
      if (dateMatch) overview.date = dateMatch[0];
    }
    
    // Extract diagnosis
    if (lower.includes('diagnosis') && lower.includes(':') && !overview.diagnosis) {
      const diagMatch = line.match(/diagnosis\s*:?\s*(.+)/i);
      if (diagMatch) overview.diagnosis = diagMatch[1].trim();
    }
  }
  
  return overview;
}

/**
 * Extract medicines from prescription text
 */
function extractMedicines(text) {
  const medicines = [];
  const lines = text.split('\n');
  
  // Look for medicine patterns
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const lower = line.toLowerCase();
    
    // Skip headers and empty lines
    if (!line || lower.includes('prescription') || lower.includes('medication') || line.length < 3) continue;
    
    // Look for medicine indicators: contains dosage patterns or tablet/capsule keywords
    if (lower.match(/\d+\s*mg/) || lower.match(/tablet|capsule|syrup|injection/) || lower.match(/\d+-\d+-\d+/)) {
      const medName = line.split(/\d/)[0].trim(); // Name before numbers
      
      if (medName && medName.length > 2) {
        medicines.push({
          name: medName || 'Medicine',
          generic_name: 'Not available',
          what_it_does: '💊 Prescribed medication for your condition',
          dosage: '1 tablet',
          frequency: 'As prescribed',
          timing: ['🌅 Morning — after breakfast', '🌙 Night — after dinner'],
          take_with: '💧 Take with full glass of water',
          duration: '📆 As per doctor\'s recommendation',
          side_effects: [
            '😮 May cause mild nausea or stomach discomfort',
            '😵 Can cause dizziness in some people',
            '🚽 May cause changes in bowel movements',
            '🔴 Stop and call doctor if you develop rash or itching',
            '😴 May cause drowsiness — avoid driving if affected'
          ],
          what_to_avoid: [
            '🍺 Avoid alcohol while taking this medicine',
            '🍽️ Do not take on empty stomach',
            '🚗 Be cautious while driving if drowsiness occurs'
          ],
          important_tip: '💡 Complete the full course as prescribed — do not stop early even if you feel better'
        });
      }
    }
  }
  
  return medicines;
}

/**
 * Extract lab results from lab report text
 */
function extractLabResults(text) {
  const results = [];
  const lines = text.split('\n');
  
  for (const line of lines) {
    // Look for patterns like "Test Name: value unit (range)"
    const match = line.match(/([a-zA-Z\s]+).*?(\d+\.?\d*)\s*(mg|mmol|g|%)?.*?(\d+\.?\d*\s*-\s*\d+\.?\d*)/);
    
    if (match) {
      const testName = match[1].trim();
      const value = match[2];
      const unit = match[3] || '';
      const range = match[4];
      
      const [min, max] = range.split('-').map(v => parseFloat(v.trim()));
      const numValue = parseFloat(value);
      
      let status = 'NORMAL';
      let emoji = '🟢';
      
      if (numValue > max) {
        status = 'HIGH';
        emoji = '🔴';
      } else if (numValue < min) {
        status = 'LOW';
        emoji = '🔴';
      }
      
      results.push({
        test_name: testName,
        your_value: `${value} ${unit}`,
        normal_range: `${range} ${unit}`,
        status: status,
        status_emoji: emoji,
        what_it_means: [
          `📊 Your ${testName} level is ${status.toLowerCase()}`,
          status !== 'NORMAL' ? '⚠️ This may require attention' : '✅ This is within healthy range'
        ],
        what_to_do: [
          '👨‍⚕️ Discuss this result with your doctor',
          status !== 'NORMAL' ? '🔄 May need follow-up testing' : '✅ Continue maintaining healthy lifestyle'
        ]
      });
    }
  }
  
  return results;
}

module.exports = router;
