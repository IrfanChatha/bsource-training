/**
 * Document text extraction and chunking service for BSource Training.
 * Supports PDF, PPTX, DOCX, and TXT files.
 */

/**
 * Split text into semantic chunks of ~1200 words each, avoiding splitting mid-sentence.
 */
export function chunkText(text, maxChunkWords = 1000) {
  const clean = text ? text.replace(/\r\n/g, '\n').trim() : '';
  if (!clean) return [];

  const paragraphs = clean.split(/\n\s*\n/);
  const chunks = [];
  let currentChunk = [];
  let currentWordCount = 0;

  for (const para of paragraphs) {
    const words = para.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) continue;

    if (currentWordCount + words.length > maxChunkWords && currentChunk.length > 0) {
      chunks.push(currentChunk.join('\n\n'));
      currentChunk = [para.trim()];
      currentWordCount = words.length;
    } else {
      currentChunk.push(para.trim());
      currentWordCount += words.length;
    }
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk.join('\n\n'));
  }

  return chunks.length > 0 ? chunks : [clean];
}

/**
 * Condense large multi-chunk documents by extracting key paragraphs and removing duplicates
 */
export function prepareTextForAI(chunks, maxTotalWords = 3500) {
  if (!chunks || chunks.length === 0) return '';
  if (chunks.length === 1) {
    return chunks[0].slice(0, 20000);
  }

  // Deduplicate and combine most informational sections
  const seenLines = new Set();
  const combined = [];
  let totalWords = 0;

  for (const chunk of chunks) {
    const lines = chunk.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.length < 15) continue;
      const normalized = trimmed.toLowerCase().slice(0, 60);
      if (!seenLines.has(normalized)) {
        seenLines.add(normalized);
        combined.push(trimmed);
        totalWords += trimmed.split(/\s+/).length;
        if (totalWords >= maxTotalWords) break;
      }
    }
    if (totalWords >= maxTotalWords) break;
  }

  return combined.join('\n\n');
}

/**
 * Extract text from File object in browser
 */
export async function extractTextFromFile(file, onProgress) {
  const fileName = file.name || 'document';
  const ext = fileName.split('.').pop()?.toLowerCase() || 'txt';

  if (onProgress) onProgress(15, `Reading ${fileName.toUpperCase()} file buffer...`);

  let rawText = '';

  if (ext === 'txt') {
    if (onProgress) onProgress(50, 'Parsing plain text encoding...');
    rawText = await file.text();
  } else if (ext === 'pdf') {
    if (onProgress) onProgress(40, 'Parsing PDF document structure...');
    const buffer = await file.arrayBuffer();
    const decoder = new TextDecoder('utf-8', { fatal: false });
    const binaryString = decoder.decode(buffer);

    const textMatches = [];
    const streamRegex = /BT[\s\S]*?ET/g;
    let match;

    while ((match = streamRegex.exec(binaryString)) !== null) {
      const TjRegex = /\(([^)]+)\)\s*Tj/g;
      let tjMatch;
      while ((tjMatch = TjRegex.exec(match[0])) !== null) {
        textMatches.push(tjMatch[1]);
      }
      const TJRegex = /\[(.*?)\]\s*TJ/g;
      let tjArrayMatch;
      while ((tjArrayMatch = TJRegex.exec(match[0])) !== null) {
        const parts = tjArrayMatch[1].match(/\(([^)]+)\)/g);
        if (parts) {
          textMatches.push(parts.map(p => p.slice(1, -1)).join(' '));
        }
      }
    }

    if (textMatches.length > 0) {
      rawText = textMatches.join(' ').replace(/\\(\d{3}|[\\()])/g, ' ');
    } else {
      const cleanChars = binaryString.replace(/[^\x20-\x7E\n\r\t]/g, ' ');
      const words = cleanChars.split(/\s+/).filter(w => w.length >= 3 && !w.startsWith('/') && !w.includes('obj'));
      rawText = words.slice(0, 4000).join(' ');
    }
  } else if (ext === 'docx' || ext === 'pptx') {
    if (onProgress) onProgress(40, `Extracting XML content from ${ext.toUpperCase()} archive...`);
    const buffer = await file.arrayBuffer();
    const decoder = new TextDecoder('utf-8', { fatal: false });
    const binary = decoder.decode(buffer);

    const xmlTextMatches = [];
    const tagRegex = /<[wa]:t[^>]*>([^<]+)<\/[wa]:t>/g;
    let tagMatch;

    while ((tagMatch = tagRegex.exec(binary)) !== null) {
      if (tagMatch[1].trim()) {
        xmlTextMatches.push(tagMatch[1].trim());
      }
    }

    if (xmlTextMatches.length > 0) {
      rawText = xmlTextMatches.join(' ');
    } else {
      const clean = binary.replace(/<[^>]+>/g, ' ').replace(/[^\x20-\x7E\n\r\t]/g, ' ');
      const words = clean.split(/\s+/).filter(w => w.length >= 3 && !w.includes('xmlns') && !w.includes('schema'));
      rawText = words.slice(0, 4000).join(' ');
    }
  } else {
    rawText = await file.text();
  }

  if (onProgress) onProgress(75, 'Cleaning and chunking document text...');

  const cleanedText = rawText
    .replace(/\t+/g, ' ')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  const chunks = chunkText(cleanedText);
  const wordCount = cleanedText ? cleanedText.split(/\s+/).length : 0;

  if (onProgress) onProgress(100, `Successfully processed ${wordCount} words into ${chunks.length} chunks.`);

  return {
    text: cleanedText,
    chunks,
    wordCount,
    charCount: cleanedText.length,
    fileName,
    fileType: ext,
  };
}
