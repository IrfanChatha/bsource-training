/**
 * Document text extraction and chunking for BSource Training.
 * Supports PDF, PPTX, DOCX, TXT and MD, in the browser.
 *
 * DOCX and PPTX files are ZIP archives and PDF content streams are usually
 * deflate-compressed, so reading the raw bytes as text yields binary noise.
 * Both are decompressed here with the platform's `DecompressionStream`.
 */

const decoder = new TextDecoder('utf-8', { fatal: false });

/* -------------------------------------------------------------------------- */
/*  Decompression helpers                                                     */
/* -------------------------------------------------------------------------- */

async function inflate(bytes, format) {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('DecompressionStream is unavailable in this browser.');
  }
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream(format));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Tries zlib then raw-deflate, returning null when neither applies. */
async function tryInflate(raw) {
  for (const format of ['deflate', 'deflate-raw']) {
    try {
      return decoder.decode(await inflate(raw, format));
    } catch {
      // Try the next container format.
    }
  }
  return null;
}

/* -------------------------------------------------------------------------- */
/*  Minimal ZIP reader (stored + deflate entries)                             */
/* -------------------------------------------------------------------------- */

/**
 * Walks the ZIP central directory so entries can be located without pulling in
 * a full archive library.
 */
async function readZipEntries(buffer, wantPath) {
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  const len = bytes.length;

  // Locate the End Of Central Directory record (signature 0x06054b50).
  let eocd = -1;
  for (let i = len - 22; i >= 0 && i > len - 65558; i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) return [];

  const entryCount = view.getUint16(eocd + 10, true);
  let offset = view.getUint32(eocd + 16, true);
  const entries = [];

  for (let i = 0; i < entryCount && offset + 46 <= len; i++) {
    if (view.getUint32(offset, true) !== 0x02014b50) break;

    const method = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const nameLen = view.getUint16(offset + 28, true);
    const extraLen = view.getUint16(offset + 30, true);
    const commentLen = view.getUint16(offset + 32, true);
    const localOffset = view.getUint32(offset + 42, true);
    const name = decoder.decode(bytes.subarray(offset + 46, offset + 46 + nameLen));

    if (wantPath(name)) {
      // The local file header repeats the name/extra lengths, which is where
      // the actual data begins.
      const lnameLen = view.getUint16(localOffset + 26, true);
      const lextraLen = view.getUint16(localOffset + 28, true);
      const dataStart = localOffset + 30 + lnameLen + lextraLen;
      const raw = bytes.subarray(dataStart, dataStart + compressedSize);

      if (method === 0) {
        entries.push({ name, text: decoder.decode(raw) });
      } else {
        const text = await tryInflate(raw);
        // A single unreadable entry should not lose the rest of the document.
        if (text !== null) entries.push({ name, text });
      }
    }

    offset += 46 + nameLen + extraLen + commentLen;
  }

  return entries;
}

/* -------------------------------------------------------------------------- */
/*  Format-specific extraction                                                */
/* -------------------------------------------------------------------------- */

const OOXML_TEXT_TAG = /<(?:w|a):t(?:\s[^>]*)?>([^<]*)<\/(?:w|a):t>/g;

function xmlToText(xml) {
  const parts = [];
  let m;
  OOXML_TEXT_TAG.lastIndex = 0;
  while ((m = OOXML_TEXT_TAG.exec(xml)) !== null) {
    if (m[1]) parts.push(m[1]);
  }
  return parts
    .join(' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

async function extractDocx(buffer) {
  const entries = await readZipEntries(
    buffer,
    (n) =>
      n === 'word/document.xml' ||
      n.startsWith('word/footnotes') ||
      n.startsWith('word/endnotes')
  );
  return entries.map((e) => xmlToText(e.text)).filter(Boolean).join('\n\n');
}

async function extractPptx(buffer) {
  const entries = await readZipEntries(buffer, (n) =>
    /^ppt\/(slides\/slide\d+|notesSlides\/notesSlide\d+)\.xml$/.test(n)
  );
  const slideNumber = (name) => Number(name.match(/(\d+)\.xml$/)?.[1] || 0);
  entries.sort((a, b) => slideNumber(a.name) - slideNumber(b.name));
  return entries.map((e) => xmlToText(e.text)).filter(Boolean).join('\n\n');
}

function unescapePdfString(s) {
  return s
    .replace(/\\([nrtbf])/g, (_, c) => ({ n: '\n', r: '\r', t: '\t', b: '', f: '' })[c] ?? '')
    .replace(/\\(\d{1,3})/g, (_, o) => String.fromCharCode(parseInt(o, 8)))
    .replace(/\\(.)/g, '$1');
}

/** Pulls text-showing operators out of a decoded PDF content stream. */
function textFromContentStream(streamText) {
  const out = [];
  const blockRegex = /BT[\s\S]*?ET/g;
  let block;
  while ((block = blockRegex.exec(streamText)) !== null) {
    const body = block[0];

    const tjRegex = /\((?:\\.|[^\\()])*\)\s*Tj/g;
    let m;
    while ((m = tjRegex.exec(body)) !== null) {
      out.push(unescapePdfString(m[0].slice(m[0].indexOf('(') + 1, m[0].lastIndexOf(')'))));
    }

    const tjArrayRegex = /\[([\s\S]*?)\]\s*TJ/g;
    while ((m = tjArrayRegex.exec(body)) !== null) {
      const pieces = m[1].match(/\((?:\\.|[^\\()])*\)/g);
      if (pieces) {
        out.push(pieces.map((p) => unescapePdfString(p.slice(1, -1))).join(''));
      }
    }
  }
  return out.join(' ');
}

/**
 * Finds every `stream ... endstream` block, inflating the deflate-compressed
 * ones, and harvests the text operators from each.
 */
async function extractPdf(buffer) {
  const bytes = new Uint8Array(buffer);
  const latin = new TextDecoder('latin1').decode(bytes);
  const chunks = [];

  // The lookbehind keeps `endstream` from matching as a stream start.
  const streamRegex = /(?<![A-Za-z])stream\r?\n?/g;
  let match;
  while ((match = streamRegex.exec(latin)) !== null) {
    const start = match.index + match[0].length;
    const end = latin.indexOf('endstream', start);
    if (end < 0) break;

    // Always jump past the binary payload, so the scanner never tries to match
    // text operators inside compressed data.
    streamRegex.lastIndex = end;

    const header = latin.slice(Math.max(0, match.index - 400), match.index);
    if (/\/(DCTDecode|JPXDecode|CCITTFaxDecode|JBIG2Decode)/.test(header)) {
      continue; // An image stream holds no text.
    }

    // Writers put an EOL between the data and `endstream`, and the
    // decompressor rejects those trailing bytes.
    let stop = end;
    while (stop > start && (bytes[stop - 1] === 0x0a || bytes[stop - 1] === 0x0d)) stop--;
    if (stop <= start) continue;
    const raw = bytes.subarray(start, stop);

    let text;
    if (/\/FlateDecode/.test(header)) {
      text = await tryInflate(raw);
      if (text === null) continue;
    } else if (/\/(LZWDecode|RunLengthDecode|ASCII85Decode|ASCIIHexDecode)/.test(header)) {
      continue; // Encodings this extractor does not implement.
    } else {
      text = latin.slice(start, stop);
    }

    const harvested = textFromContentStream(text);
    if (harvested.trim()) chunks.push(harvested);
  }

  return chunks.join('\n');
}

/* -------------------------------------------------------------------------- */
/*  Chunking                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Split text into semantic chunks of ~1000 words each, avoiding splitting
 * mid-paragraph.
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
 * Condense large multi-chunk documents by extracting key lines and removing
 * near-duplicates, so the quiz generator gets the most informative text.
 */
export function prepareTextForAI(chunks, maxTotalWords = 3500) {
  if (!chunks || chunks.length === 0) return '';
  if (chunks.length === 1) {
    return chunks[0].slice(0, 20000);
  }

  const seenLines = new Set();
  const combined = [];
  let totalWords = 0;

  for (const chunk of chunks) {
    for (const line of chunk.split('\n')) {
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

/* -------------------------------------------------------------------------- */
/*  Entry point                                                               */
/* -------------------------------------------------------------------------- */

export const SUPPORTED_EXTENSIONS = ['pdf', 'pptx', 'docx', 'txt', 'md'];

/**
 * Extracts text from a browser `File`. Throws when a document yields no
 * readable text, so the caller can tell the user instead of silently storing
 * an empty record.
 */
export async function extractTextFromFile(file, onProgress) {
  const fileName = file.name || 'document';
  const ext = (fileName.split('.').pop() || 'txt').toLowerCase();

  if (onProgress) onProgress(10, `Reading ${fileName}...`);

  let rawText = '';

  if (ext === 'txt' || ext === 'md') {
    if (onProgress) onProgress(45, 'Parsing plain text...');
    rawText = await file.text();
  } else if (ext === 'pdf') {
    if (onProgress) onProgress(35, 'Decompressing PDF content streams...');
    rawText = await extractPdf(await file.arrayBuffer());
  } else if (ext === 'docx') {
    if (onProgress) onProgress(35, 'Unpacking DOCX archive...');
    rawText = await extractDocx(await file.arrayBuffer());
  } else if (ext === 'pptx') {
    if (onProgress) onProgress(35, 'Unpacking PPTX slides...');
    rawText = await extractPptx(await file.arrayBuffer());
  } else {
    throw new Error(
      `Unsupported file type ".${ext}". Upload one of: ${SUPPORTED_EXTENSIONS.join(', ')}.`
    );
  }

  if (onProgress) onProgress(70, 'Cleaning and chunking text...');

  const cleanedText = rawText
    .replace(/ /g, '')
    .replace(/\t+/g, ' ')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (!cleanedText) {
    throw new Error(
      `No readable text could be extracted from ${fileName}. ` +
        'Scanned or image-only documents need OCR before they can be used for quiz generation.'
    );
  }

  const chunks = chunkText(cleanedText);
  const wordCount = cleanedText.split(/\s+/).filter(Boolean).length;

  if (onProgress) onProgress(80, `Extracted ${wordCount} words into ${chunks.length} chunk(s).`);

  return {
    text: cleanedText,
    chunks,
    wordCount,
    charCount: cleanedText.length,
    fileName,
    fileType: ext,
  };
}
