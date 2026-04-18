import { GoogleGenAI, Type } from '@google/genai';

const apiKey = process.env.GEMINI_API_KEY;
export const ai = new GoogleGenAI({ apiKey: apiKey });

export const getCustomAi = async () => {
    // Check if user has selected key
    // @ts-ignore
    if (window.aistudio && window.aistudio.hasSelectedApiKey) {
        // @ts-ignore
        const hasKey = await window.aistudio.hasSelectedApiKey();
        if (!hasKey) {
            // @ts-ignore
            await window.aistudio.openSelectKey();
        }
    }
    return new GoogleGenAI({ apiKey: process.env.API_KEY || apiKey });
};

export const fileTools = [

  {
    functionDeclarations: [
      {
         name: "evaluateStupidity",
         description: "Evaluates the stupidity of the preceding user message.",
         parameters: {
             type: Type.OBJECT,
             properties: {
                 stupidityScore: { type: Type.INTEGER, description: "Score from 0 to 100 representing how stupid it was." },
                 feedback: { type: Type.STRING, description: "A witty, sarcastic roast or praise of their stupidity." }
             },
             required: ["stupidityScore", "feedback"]
         }
      },
      {
         name: "generateImage",
         description: "Generates an image of the user's stupid idea to mock it visually.",
         parameters: {
             type: Type.OBJECT,
             properties: {
                 prompt: { type: Type.STRING }
             },
             required: ["prompt"]
         }
      },
      {
         name: "generateVideo",
         description: "Generates a video of the user's stupid idea.",
         parameters: {
             type: Type.OBJECT,
             properties: {
                 prompt: { type: Type.STRING }
             },
             required: ["prompt"]
         }
      },
      {
         name: "generateGif",
         description: "Generates a short, looping animated sequence (GIF format style) to continuously mock the user's absurd logic.",
         parameters: {
             type: Type.OBJECT,
             properties: {
                 prompt: { type: Type.STRING, description: "A highly visual prompt focusing on repeated motion or looping stupidity." }
             },
             required: ["prompt"]
         }
      },
      {
         name: "generateMusic",
         description: "Generates a music clip summarizing the user's stupid idea.",
         parameters: {
             type: Type.OBJECT,
             properties: {
                 prompt: { type: Type.STRING }
             },
             required: ["prompt"]
         }
      }
    ]
  }
];
