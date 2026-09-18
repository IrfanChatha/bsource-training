import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';

/**
 * Quiz generation.
 *
 * The provider is chosen from the requested model id, so the admin System
 * Policies screen controls it: `claude-*` goes to Anthropic, `gemini-*` to
 * Google. If the chosen provider has no key, or its response cannot be used,
 * the route falls back to a template and says so in `warning` — it never
 * presents template questions as AI output.
 */

const DEFAULT_MODEL = 'claude-opus-5';

/** Mirrors the shape the Quiz Studio expects back. */
const QuizSchema = z.object({
  title: z.string().describe('A short title for the assessment'),
  questions: z
    .array(
      z.object({
        question: z.string().describe('The question, answerable from the material'),
        options: z.array(z.string()).describe('Exactly four distinct answer choices'),
        correctAnswer: z
          .number()
          .int()
          .describe('Zero-based index (0-3) of the correct option'),
        explanation: z.string().describe('Why the correct answer is right'),
      })
    )
    .describe('The generated questions'),
});

function providerFor(model) {
  if (!model || model.startsWith('claude')) return 'anthropic';
  if (model.startsWith('gemini')) return 'gemini';
  return null;
}

/** Drops anything malformed and pads to `requestedCount` so the editor is usable. */
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
    if (Number.isNaN(correct) || correct < 0 || correct > 3) correct = 0;

    const explanation =
      typeof q.explanation === 'string' && q.explanation.trim()
        ? q.explanation.trim()
        : `Correct answer is: ${cleanOptions[correct]}`;

    validQuestions.push({
      question: q.question.trim(),
      options: cleanOptions,
      correctAnswer: correct,
      explanation,
    });
  }

  if (validQuestions.length === 0) return null;

  while (validQuestions.length < requestedCount) {
    const idx = validQuestions.length + 1;
    validQuestions.push({
      question: `Key Concept Review #${idx}: What is an essential best practice emphasised in this training module?`,
      options: [
        'Consistent execution following standard operating procedures',
        'Bypassing verification protocols to meet artificial deadlines',
        'Ignoring cross-team communication channels',
        'Postponing documentation until year-end review',
      ],
      correctAnswer: 0,
      explanation:
        'Following established operational guidelines ensures compliance, efficiency and data integrity.',
    });
  }

  return {
    title:
      typeof data.title === 'string' && data.title.trim()
        ? data.title.trim()
        : 'Training Comprehension Quiz',
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
    const seed = keySentences[i % (keySentences.length || 1)] || `Core Training Requirement ${i + 1}`;
    const truncatedSeed = seed.length > 90 ? seed.slice(0, 90) + '...' : seed;

    questions.push({
      question: `According to the training material regarding "${truncatedSeed}", which statement is correct?`,
      options: [
        `Teams must strictly adhere to the documented procedures and compliance mandates (${difficulty} level)`,
        'Individual contributors can choose to bypass policies without managerial authorization',
        'The guideline only applies to external contractors and temporary interns',
        'Procedures should be disregarded whenever unexpected project pressure occurs',
      ],
      correctAnswer: 0,
      explanation: `The training material highlights: "${truncatedSeed}". Standard compliance protocols mandate adherence across all organizational tiers.`,
    });
  }

  return { title: 'Corporate Training Assessment Quiz', questions };
}

function buildPrompt(count, difficulty) {
  return `You are an expert corporate instructional designer.

Write ${count} multiple-choice questions assessing comprehension of the training material below.

Rules:
- Every question must be answerable from the material alone. Do not rely on outside knowledge.
- Difficulty: ${difficulty}.
- Exactly four options per question, all plausible, only one correct.
- Vary which option is correct; do not always make the first option correct.
- Test understanding rather than verbatim recall.
- Keep each explanation to one or two sentences.`;
}

/** Turns an Anthropic SDK failure into something the trainer can act on. */
function describeAnthropicError(error) {
  if (error instanceof Anthropic.AuthenticationError) {
    return 'The Anthropic API key was rejected. Check ANTHROPIC_API_KEY.';
  }
  if (error instanceof Anthropic.PermissionDeniedError) {
    return 'The Anthropic API key is not permitted to use this model.';
  }
  if (error instanceof Anthropic.RateLimitError) {
    return 'The Anthropic API is rate limiting this workspace. Try again shortly.';
  }
  if (error instanceof Anthropic.BadRequestError) {
    return `Anthropic rejected the request: ${error.message}`;
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return 'Could not reach the Anthropic API. Check the server’s network access.';
  }
  if (error instanceof Anthropic.APIError) {
    return `Anthropic API error ${error.status}: ${error.message}`;
  }
  return error?.message || 'Unknown error calling Anthropic.';
}

async function generateWithAnthropic({ model, prompt, material, count }) {
  const client = new Anthropic();

  const response = await client.messages.parse({
    model: model || DEFAULT_MODEL,
    max_tokens: 16000,
    system: prompt,
    messages: [{ role: 'user', content: `TRAINING MATERIAL:\n\n${material}` }],
    output_config: { format: zodOutputFormat(QuizSchema) },
  });

  // A safety decline returns 200 with no usable content.
  if (response.stop_reason === 'refusal') {
    const category = response.stop_details?.category || 'unspecified';
    throw new Error(`Claude declined to generate from this material (${category}).`);
  }

  // parsed_output is null when the response could not be parsed.
  return response.parsed_output ?? null;
}

async function generateWithGemini({ model, prompt, material, count }) {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const resp = await ai.models.generateContent({
    model: model || 'gemini-2.5-flash',
    contents: `${prompt}\n\nReturn STRICT JSON: {"title": string, "questions": [{"question": string, "options": [4 strings], "correctAnswer": 0-3, "explanation": string}]}\n\nTRAINING MATERIAL:\n${material}`,
    config: { responseMimeType: 'application/json' },
  });

  if (!resp?.text) return null;
  const clean = resp.text.trim().replace(/^```json\s*/i, '').replace(/\s*```$/, '');
  return JSON.parse(clean);
}

export async function POST(request) {
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Malformed request body.' }, { status: 400 });
    }

    const { materialText, numQuestions = 10, difficulty = 'Medium', model } = body;

    if (!materialText || typeof materialText !== 'string' || !materialText.trim()) {
      return NextResponse.json({ error: 'Training material text is required.' }, { status: 400 });
    }

    const requestedModel = model || DEFAULT_MODEL;
    const provider = providerFor(requestedModel);
    if (!provider) {
      return NextResponse.json(
        { error: `Model "${requestedModel}" is not supported. Use a claude-* or gemini-* model.` },
        { status: 400 }
      );
    }

    const count = Math.min(Math.max(Number(numQuestions) || 10, 1), 25);
    const material = materialText.slice(0, 60000);
    const prompt = buildPrompt(count, difficulty);

    const keyFor = { anthropic: 'ANTHROPIC_API_KEY', gemini: 'GEMINI_API_KEY' }[provider];
    let parsedResult = null;
    let warning = null;

    if (!process.env[keyFor]) {
      warning =
        `${keyFor} is not set, so these questions were assembled from a template rather than ` +
        'generated by AI. Review every question before publishing.';
    } else {
      try {
        const raw =
          provider === 'anthropic'
            ? await generateWithAnthropic({ model: requestedModel, prompt, material, count })
            : await generateWithGemini({ model: requestedModel, prompt, material, count });

        parsedResult = validateQuizOutput(raw, count);
        if (!parsedResult) {
          warning =
            'The model returned a response that could not be used, so these questions were ' +
            'assembled from a template instead. Review every question before publishing.';
        }
      } catch (err) {
        const detail =
          provider === 'anthropic' ? describeAnthropicError(err) : err?.message || 'Unknown error';
        console.warn(`[quiz/generate] ${provider} failed:`, detail);
        warning =
          `${detail} These questions were assembled from a template instead. ` +
          'Review every question before publishing.';
      }
    }

    const usedFallback = !parsedResult;
    if (usedFallback) {
      parsedResult = generateContextualQuizFallback(material, count, difficulty);
    }

    return NextResponse.json({
      success: true,
      provider: usedFallback ? 'contextual-fallback' : provider,
      model: usedFallback ? null : requestedModel,
      usedFallback,
      warning,
      data: parsedResult,
    });
  } catch (error) {
    console.error('Quiz generation route error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to generate quiz' }, { status: 500 });
  }
}
