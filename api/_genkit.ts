import { genkit } from "genkit";
import { groq } from "genkitx-groq";
export { db } from "../lib/firebase-admin";

// 2026 Tech Stack: Genkit + Groq AI Surge
export const ai = genkit({
  plugins: [
    groq({ apiKey: process.env.GROQ_API_KEY })
  ],
});
