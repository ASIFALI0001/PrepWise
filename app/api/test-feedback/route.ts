import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";

const feedbackSchema = z.object({
    totalScore: z.number(),
    categoryScores: z.array(
        z.object({
            name: z.string(),
            score: z.number(),
            comment: z.string(),
        })
    ),
    strengths: z.array(z.string()),
    areasForImprovement: z.array(z.string()),
    finalAssessment: z.string(),
});

const dummyTranscript = `
- assistant: Hello! Tell me about yourself.
- user: I am a frontend developer with 2 years of experience in React and TypeScript.
- assistant: What is the difference between props and state in React?
- user: Props are passed from parent to child and are immutable. State is managed within the component and can change over time.
- assistant: Good! How do you handle side effects in React?
- user: I use the useEffect hook to handle side effects like API calls and subscriptions.
`;

export async function GET() {
    try {
        console.log("🔄 Testing feedback generation...");

        const { object } = await generateObject({
            model: google("gemini-2.5-flash"), // ✅ correct model
            schema: feedbackSchema,
            prompt: `
You are evaluating a candidate interview.

Transcript:
${dummyTranscript}

Score (0-100) for each of these 5 categories:
1. Communication Skills
2. Technical Knowledge
3. Problem Solving
4. Cultural Fit
5. Confidence and Clarity

Provide comment for each, strengths, areas for improvement, and final assessment.
`,
        });

        return Response.json({
            success: true,
            feedback: object,
        });

    } catch (error: any) {
        console.error("❌ Error:", error.message);
        return Response.json({
            success: false,
            error: error.message,
        });
    }
}