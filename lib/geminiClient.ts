const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 2000;

export interface GeminiRequestOptions {
  apiKey: string;
  contents: { parts: { text: string }[] }[];
  systemInstruction?: { parts: { text: string }[] };
  tools?: object[];
  temperature?: number;
  maxOutputTokens?: number;
}

export interface GroundingChunk {
  web?: { uri: string; title?: string };
}

export interface GeminiResult {
  text: string;
  groundingUrls: string[];
}

export async function geminiRequest(options: GeminiRequestOptions): Promise<GeminiResult> {
  if (!options.apiKey) {
    throw new Error("Gemini API-Key fehlt. Bitte in .env konfigurieren.");
  }

  const hasTools = Array.isArray(options.tools) && options.tools.length > 0;
  const generationConfig: Record<string, unknown> = {
    temperature: options.temperature ?? 0.2,
    maxOutputTokens: options.maxOutputTokens ?? 8192,
  };
  if (!hasTools) {
    generationConfig.response_mime_type = "application/json";
  }
  // Mit Tools (z. B. google_search) response_mime_type nie mitsenden – API antwortet sonst mit 400.

  const body: Record<string, unknown> = {
    contents: options.contents,
    generationConfig,
  };

  if (options.systemInstruction) {
    body.system_instruction = options.systemInstruction;
  }
  if (options.tools) {
    body.tools = options.tools;
  }

  const requestBody = JSON.stringify(body);

  let response: Response | null = null;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    response = await fetch(`${GEMINI_URL}?key=${options.apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: requestBody,
    });

    if (response.ok) break;

    const errorBody = await response.text().catch(() => "");
    console.warn(`Gemini API error ${response.status}:`, errorBody);

    const retryable = response.status === 429 || response.status === 503;
    if (retryable && attempt < MAX_RETRIES) {
      const delay = BASE_DELAY_MS * Math.pow(2, attempt);
      console.warn(`Gemini ${response.status}, retry ${attempt + 1}/${MAX_RETRIES} in ${delay}ms`);
      await new Promise((r) => setTimeout(r, delay));
      continue;
    }

    if (response.status === 429) {
      throw new Error("Rate-Limit erreicht. Bitte warte eine Minute und versuche es erneut.");
    }
    if (response.status === 503) {
      throw new Error(
        "Der KI-Service ist gerade stark ausgelastet. Bitte in ein paar Minuten erneut versuchen."
      );
    }
    throw new Error(`Gemini API Fehler (${response.status})`);
  }

  const result = await (response as Response).json();

  const candidate = result?.candidates?.[0];

  if (!candidate) {
    const blockReason = result?.promptFeedback?.blockReason;
    if (blockReason) {
      console.warn("Gemini blocked:", blockReason);
      throw new Error(`KI-Anfrage wurde blockiert (${blockReason}). Bitte andere Suchbegriffe versuchen.`);
    }
    console.warn("Gemini: No candidates in response", JSON.stringify(result).substring(0, 500));
    return { text: "", groundingUrls: [] };
  }

  const finishReason = candidate.finishReason;
  if (finishReason === "SAFETY") {
    console.warn("Gemini: Response blocked by safety filter");
    throw new Error("KI-Antwort wurde wegen Sicherheitsfilter blockiert. Bitte erneut versuchen.");
  }

  const text = candidate.content?.parts
    ?.map((p: any) => p.text ?? "")
    .join("") ?? "";

  const groundingUrls = extractGroundingUrls(candidate);

  return { text, groundingUrls };
}

function extractGroundingUrls(candidate: any): string[] {
  const chunks: GroundingChunk[] =
    candidate?.groundingMetadata?.groundingChunks ?? [];
  return chunks
    .map((c) => c.web?.uri)
    .filter((uri): uri is string => !!uri);
}

export function parseJsonArray<T>(text: string): T[] {
  if (!text) return [];

  // 1. Direkt parsen
  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [];
  } catch { /* weiter */ }

  // 2. Markdown-Codeblöcke und Prosa vor/nach dem Array entfernen
  const cleaned = text
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim();

  // Alles ab dem ersten "[" nehmen
  const startIdx = cleaned.indexOf("[");
  if (startIdx < 0) return [];

  let jsonStr = cleaned.substring(startIdx);

  // 3. Vollständiges Array?
  const endIdx = jsonStr.lastIndexOf("]");
  if (endIdx > 0) {
    const candidate = jsonStr.substring(0, endIdx + 1);
    try {
      const parsed = JSON.parse(candidate);
      return Array.isArray(parsed) ? parsed : [];
    } catch { /* weiter – evtl. korrupte Einträge */ }
  }

  // 4. Abgeschnitten (kein schließendes "]" oder JSON-Fehler):
  //    Letztes vollständiges Objekt finden und Array schließen
  const lastBrace = jsonStr.lastIndexOf("}");
  if (lastBrace > 0) {
    jsonStr = jsonStr.substring(0, lastBrace + 1);
    // Trailing-Komma entfernen, dann schließen
    const trimmedForParse = jsonStr.replace(/,\s*$/, "") + "]";
    try {
      const parsed = JSON.parse(trimmedForParse);
      return Array.isArray(parsed) ? parsed : [];
    } catch { /* weiter */ }

    // Letztes vollständiges "}, " als Abschnitt nehmen
    const lastComplete = jsonStr.lastIndexOf("},");
    if (lastComplete > 0) {
      try {
        return JSON.parse(jsonStr.substring(0, lastComplete + 1) + "]");
      } catch { /* aufgeben */ }
    }
  }

  return [];
}
