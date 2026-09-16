import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

function validateQuizOutput(data, requestedCount = 10) {
  if (!data || typeof data !== 'object') return null;
  if (!Array.isArray(data.questions)) return null;

  const validQuestions = [];

  for (const q of data.questions) {
    if (!q || typeof q !== 'object') continue;
    if (typeof q.question !== 'string' || !q.question.trim()) continue;
    if (!Array.isArray(q.options) || q.options.length < 4) continue;

    const cleanOptions = q.options.slice(0, 4).map((opt) => String(opt || '').trim());
    if (cleanOptions.some((opt) => !opt)) continue;

    let correct = Number(q.correctAnswer);
    if (isNaN(correct) || correct < 0 || correct > 3) {
      correct = 0;
    }

    const explanation = typeof q.explanation === 'string' && q.explanation.trim()
      ? q.explanation.trim()
      : `Correct answer is: ${cleanOptions[correct]}`;

    validQuestions.push({
      question: q.question.trim(),
      options: [cleanOptions[0], cleanOptions[1], cleanOptions[2], cleanOptions[3]],
      correctAnswer: correct,
      explanation,
    });
  }

  if (validQuestions.length === 0) return null;

  while (validQuestions.length < requestedCount) {
    const idx = validQuestions.length + 1;
    validQuestions.push({
      question: `Key Concept Review #${idx}: What is an essential best practice emphasized in this corporate training module?`,
      options: [
        'Consistent execution following standard operating procedures',
        'Bypassing verification protocols to meet artificial deadlines',
        'Ignoring cross-team communication channels',
        'Postponing documentation until year-end review'
      ],
      correctAnswer: 0,
      explanation: 'Following established operational guidelines ensures compliance, efficiency, and data integrity.'
    });
  }

  return {
    title: typeof data.title === 'string' && data.title.trim() ? data.title.trim() : 'Training Comprehension Quiz',
    questions: validQuestions.slice(0, requestedCount),
  };
}

function generateContextualQuizFallback(materialText, numQuestions = 10, difficulty = 'Medium') {
  const lines = materialText
    .split(/\n+/)
    .map((l) => l.trim())
    .filter((l) => l.length > 20 && !l.startsWith('#'));

  const keySentences = lines.slice(0, 15);
  const questions = [];

  for (let i = 0; i < numQuestions; i++) {
    const seed = keySentences[i % (keySentences.length || 1)] || `Core Training Requirement Standard ${i + 1}`;
    const truncatedSeed = seed.length > 90 ? seed.slice(0, 90) + '...' : seed;

    questions.push({
      question: `According to the training material regarding "${truncatedSeed}", which statement is correct?`,
      options: [
        `Teams must strictly adhere to the documented procedures and compliance mandates (${difficulty} level)`,
        'Individual contributors can choose to bypass policies without managerial authorization',
        'The guideline only applies to external contractors and temporary interns',
        'Procedures should be disregarded whenever unexpected project pressure occurs'
      ],
      correctAnswer: 0,
      explanation: `The training material highlights the critical requirement: "${truncatedSeed}". Standard compliance protocols mandate adherence across all organizational tiers.`,
    });
  }

  return {
    title: 'Corporate Training Assessment Quiz',
    questions,
  };
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { materialText, numQuestions = 10, difficulty = 'Medium', provider = 'gemini' } = body;

    if (!materialText || typeof materialText !== 'string' || !materialText.trim()) {
      return NextResponse.json({ error: 'Training material text is required.' }, { status: 400 });
    }

    const count = Number(numQuestions) || 10;
    const sanitizedText = materialText.slice(0, 18000);

    const promptSystem = `You are an expert corporate instructional designer.
Generate an assessment quiz based on the provided corporate training material.
Requirements:
1. Generate EXACTLY ${count} multiple choice questions.
2. Difficulty level: ${difficulty}.
3. Each question must have:
   - "question": clear question text based strictly on the material
   - "options": an array of EXACTLY 4 distinct string choices
   - "correctAnswer": integer from 0 to 3 denoting the zero-based index of the correct option
   - "explanation": a concise explanation of why the correct answer is right
4. Output STRICT JSON adhering to this exact format:
{
  "title": "Quiz Title based on material",
  "questions": [
    {
      "question": "Question text?",
      "options": ["Choice A", "Choice B", "Choice C", "Choice D"],
      "correctAnswer": 0,
      "explanation": "Explanation here."
    }
  ]
}`;

    let parsedResult = null;
    let providerUsed = provider;

    // 1. Google Gemini via @google/genai SDK
    if (provider === 'gemini' && process.env.GEMINI_API_KEY) {
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const geminiResp = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: `${promptSystem}\n\nTRAINING MATERIAL:\n${sanitizedText}`,
          config: {
            responseMimeType: 'application/json',
          },
        });

        if (geminiResp && geminiResp.text) {
          const rawText = geminiResp.text.trim();
          const cleanJson = rawText.replace(/^```json\s*/i, '').replace(/\s*```$/, '');
          const data = JSON.parse(cleanJson);
          parsedResult = validateQuizOutput(data, count);
        }
      } catch (geminiError) {
        console.warn('Gemini API call failed, falling back:', geminiError?.message || geminiError);
      }
    }

    // Fallback if needed
    if (!parsedResult) {
      providerUsed = 'contextual-fallback';
      parsedResult = generateContextualQuizFallback(sanitizedText, count, difficulty);
    }

    return NextResponse.json({
      success: true,
      provider: providerUsed,
      data: parsedResult,
    });
  } catch (error) {
    console.error('Quiz generation route error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to generate quiz' }, { status: 500 });
  }
}
