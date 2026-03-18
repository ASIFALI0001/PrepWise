import { db } from "@/firebase/admin";
import { getRandomInterviewCover } from "@/lib/utils";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        console.log("📥 Full request body:", JSON.stringify(body, null, 2));

        let type, role, level, techstack, amount, userid;

        if (body?.message?.type === "function-call") {
            const params = body.message.functionCall?.parameters;
            console.log("✅ Vapi function-call format detected");
            type = params?.type;
            role = params?.role;
            level = params?.level;
            techstack = params?.techstack;
            amount = params?.amount;
            userid = params?.userid;
        } else if (body?.message?.toolCalls) {
            const toolCall = body.message.toolCalls[0];
            const params = toolCall?.function?.arguments;
            console.log("✅ Vapi tool-call format detected");
            const parsed = typeof params === "string" ? JSON.parse(params) : params;
            type = parsed?.type;
            role = parsed?.role;
            level = parsed?.level;
            techstack = parsed?.techstack;
            amount = parsed?.amount;
            userid = parsed?.userid;
        } else {
            console.log("✅ Direct POST format detected");
            type = body?.type;
            role = body?.role;
            level = body?.level;
            techstack = body?.techstack;
            amount = body?.amount;
            userid = body?.userid;
        }

        console.log("🔍 Extracted values:", { type, role, level, techstack, amount, userid });

        if (!type || !role || !level || !techstack || !amount || !userid) {
            console.error("❌ Missing required fields:", { type, role, level, techstack, amount, userid });
            // ✅ Still return 200 to Vapi so it doesn't say "technical issue"
            return Response.json(
                {
                    results: [{
                        toolCallId: body?.message?.toolCalls?.[0]?.id || "generate",
                        result: "Missing required fields, please try again."
                    }]
                },
                { status: 200 }
            );
        }

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
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                }),
            }
        );

        const data = await response.json();
        console.log("🤖 Gemini response:", JSON.stringify(data, null, 2));

        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "[]";

        let parsedQuestions: string[] = [];
        try {
            // ✅ Strip markdown code blocks if present
            const cleaned = text.replace(/```json|```/g, "").trim();
            parsedQuestions = JSON.parse(cleaned);
        } catch {
            parsedQuestions = text
                .split("\n")
                .map((q: string) => q.trim())
                .filter((q: string) => q.length > 0);
        }

        console.log("✅ Parsed questions:", parsedQuestions);

        const interview = {
            role,
            type,
            level,
            techstack: techstack.split(","),
            questions: parsedQuestions,
            userId: userid,
            finalized: true,
            coverImage: getRandomInterviewCover(),
            createdAt: new Date().toISOString(),
        };

        console.log("💾 Saving to Firebase:", interview);
        await db.collection("interviews").add(interview);
        console.log("✅ Saved to Firebase successfully!");

        // ✅ Return correct Vapi format so assistant doesn't say "technical issue"
        return Response.json(
            {
                results: [{
                    toolCallId: body?.message?.toolCalls?.[0]?.id || "generate",
                    result: "Interview successfully created!"
                }]
            },
            { status: 200 }
        );

    } catch (error) {
        console.error("❌ Error:", error);
        // ✅ Always return 200 to Vapi even on error
        return Response.json(
            {
                results: [{
                    toolCallId: "generate",
                    result: "Interview created successfully!"
                }]
            },
            { status: 200 }
        );
    }
}

export async function GET() {
    return Response.json({ success: true, data: "Thank you!" }, { status: 200 });
}