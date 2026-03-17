import { db } from "@/firebase/admin";
import { getRandomInterviewCover } from "@/lib/utils";

export async function POST(request: Request) {
    const { type, role, level, techstack, amount, userid } =
        await request.json();

    try {
        const prompt = `
Prepare questions for a job interview.
Role: ${role}
Level: ${level}
Tech stack: ${techstack}
Focus: ${type}
Number of questions: ${amount}

Return ONLY a JSON array like:
["Question 1", "Question 2"]
`;

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-pro:generateContent?key=${process.env.GOOGLE_GENERATIVE_AI_API_KEY}`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    contents: [
                        {
                            parts: [{ text: prompt }],
                        },
                    ],
                }),
            }
        );

        const data = await response.json();

        const text =
            data?.candidates?.[0]?.content?.parts?.[0]?.text || "[]";

        // ✅ Safe JSON parsing
        let parsedQuestions: string[] = [];

        try {
            parsedQuestions = JSON.parse(text);
        } catch {
            parsedQuestions = text
                .split("\n")
                .map((q: string) => q.trim())
                .filter((q: string) => q.length > 0);
        }

        const interview = {
            role,
            type,
            level,
            techstack: techstack.split(","),
            questions: parsedQuestions,
            userId: userid,
            finalized: true,
            coverImage: getRandomInterviewCover(), // ✅ BACK TO ORIGINAL
            createdAt: new Date().toISOString(),
        };

        await db.collection("interviews").add(interview);

        return Response.json({ success: true }, { status: 200 });
    } catch (error) {
        console.error("Error:", error);
        return Response.json({ success: false, error }, { status: 500 });
    }
}

export async function GET() {
    return Response.json(
        { success: true, data: "Thank you!" },
        { status: 200 }
    );
}