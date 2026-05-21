import OpenAI from "openai";

let openai: OpenAI | null = null;

export function getOpenAIClient(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey === "sk-your-api-key-here") {
    return null;
  }
  if (!openai) {
    openai = new OpenAI({ apiKey });
  }
  return openai;
}

export default openai;
