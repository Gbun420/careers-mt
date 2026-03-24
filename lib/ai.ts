import Groq from 'groq-sdk';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY || ''
});

export async function generateJobDescription(title: string, requirements: string) {
  const chatCompletion = await groq.chat.completions.create({
    messages: [
      {
        role: "system",
        content: "You are a professional HR specialist."
      },
      {
        role: "user",
        content: `Create a professional job description for ${title} with these requirements: ${requirements}`
      }
    ],
    model: "llama3-8b-8192",
  });
  
  return chatCompletion.choices[0]?.message?.content || '';
}

export async function calculateFitScore(resume: string, jobDescription: string) {
  const chatCompletion = await groq.chat.completions.create({
    messages: [
      {
        role: "system",
        content: "Analyze resumes against job descriptions. Return ONLY a JSON object with 'score' (0-100) and 'explanation' (1 sentence)."
      },
      {
        role: "user",
        content: `Based on this resume: "${resume}" and this job description: "${jobDescription}", provide a fit score from 0-100 and explain why. Return in JSON format: {"score": number, "explanation": string}`
      }
    ],
    model: "llama3-8b-8192",
    response_format: { type: "json_object" }
  });
  
  const content = chatCompletion.choices[0]?.message?.content || '{"score": 50, "explanation": "Default score"}';
  return parseFitScore(content);
}

export function parseFitScore(content: string) {
  try {
    const parsed = JSON.parse(content);
    const score = typeof parsed.score === 'number' ? parsed.score : 50;
    const explanation = typeof parsed.explanation === 'string'
      ? parsed.explanation
      : 'AI analysis failed.';

    return { score, explanation };
  } catch {
    return { score: 50, explanation: 'AI analysis failed.' };
  }
}
