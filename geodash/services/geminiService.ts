import { GoogleGenAI, Type } from "@google/genai";
import { EntityType, LevelObject } from '../types';

export const generateLevelAI = async (prompt: string, currentLength: number): Promise<LevelObject[]> => {
  try {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      throw new Error("API Key not found");
    }

    const ai = new GoogleGenAI({ apiKey });

    // Schema definition for the output
    const responseSchema = {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          type: { type: Type.STRING, enum: [EntityType.BLOCK, EntityType.SPIKE] },
          x: { type: Type.INTEGER, description: "X grid coordinate. Must be greater than 0." },
          y: { type: Type.INTEGER, description: "Y grid coordinate. 1 is the floor level. 2 is one block up." }
        },
        required: ["type", "x", "y"]
      }
    };

    const systemInstruction = `
      You are a level designer for a Geometry Dash-like game.
      Create a challenging but possible segment of a level based on the user's description.
      The output must be a JSON array of objects with 'type' (BLOCK or SPIKE), 'x', and 'y'.
      The 'x' coordinates should start around 10 and go up to roughly ${currentLength}.
      The 'y' coordinates:
      - y=1: On the floor (ground level).
      - y=2: One block high (requires jump).
      - y=3: Two blocks high.
      Avoid y > 6 (too high).
      Spikes kill the player. Blocks are safe to land on.
      Ensure the jumps are physically possible.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        responseSchema: responseSchema,
      },
    });

    const text = response.text;
    if (!text) return [];

    const rawData = JSON.parse(text);
    
    // Map to internal structure with IDs
    return rawData.map((item: any, index: number) => ({
      id: `ai-${Date.now()}-${index}`,
      type: item.type === 'SPIKE' ? EntityType.SPIKE : EntityType.BLOCK,
      x: item.x,
      y: item.y
    }));

  } catch (error) {
    console.error("Error generating level:", error);
    throw error;
  }
};
