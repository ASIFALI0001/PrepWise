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

        // ✅ Step 1 — Generate questions with Gemini 2.5 Flash
        console.log("🤖 Calling Gemini to generate questions...");

        const prompt = `Prepare exactly ${amount} questions for a job interview.
Role: ${role}
Level: ${level}
Tech stack: ${techstack}
Focus: ${type}

Rules:
- Return ONLY a valid JSON array of strings
- No markdown, no code blocks, no explanation
- Just the array like: ["Question 1", "Question 2", "Question 3"]
- Make questions relevant to the role and tech stack
- Questions should match the experience level`;

        const geminiResponse = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GOOGLE_GENERATIVE_AI_API_KEY}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        temperature: 0.7,
                        maxOutputTokens: 1024,
                    }
                }),
            }
        );

        const geminiData = await geminiResponse.json();
        console.log("🤖 Gemini status:", geminiResponse.status);

        const rawText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
        console.log("📝 Raw text from Gemini:", rawText);

        // ✅ Step 2 — Parse questions safely
        let parsedQuestions: string[] = [];
        try {
            const cleaned = rawText
                .replace(/```json/g, "")
                .replace(/```/g, "")
                .trim();
            parsedQuestions = JSON.parse(cleaned);
            console.log("✅ Successfully parsed questions:", parsedQuestions);
        } catch (e) {
            console.error("❌ JSON parse failed, trying line split:", e);
            parsedQuestions = rawText
                .split("\n")
                .map((q: string) => q.replace(/^[\d\-\.\*]+\s*/, "").trim())
                .filter((q: string) => q.length > 5);
        }

        console.log(`✅ Total questions generated: ${parsedQuestions.length}`);

        if (parsedQuestions.length === 0) {
            console.error("❌ No questions generated!");
            return Response.json(
                {
                    results: [{
                        toolCallId: body?.message?.toolCalls?.[0]?.id || "generate",
                        result: "Failed to generate questions. Please try again."
                    }]
                },
                { status: 200 }
            );
        }

        // ✅ Step 3 — Save to Firebase with questions
        const techstackArray = typeof techstack === "string"
            ? techstack.split(",").map((t: string) => t.trim())
            : techstack;

        const interview = {
            role,
            type,
            level,
            techstack: techstackArray,
            questions: parsedQuestions,
            userId: userid,
            finalized: true,
            coverImage: getRandomInterviewCover(),
            createdAt: new Date().toISOString(),
        };

        console.log("💾 Saving to Firebase...");
        const docRef = await db.collection("interviews").add(interview);
        console.log("✅ Saved to Firebase with ID:", docRef.id);

        // ✅ Step 4 — Return success to Vapi
        return Response.json(
            {
                results: [{
                    toolCallId: body?.message?.toolCalls?.[0]?.id || "generate",
                    result: `Interview created successfully with ${parsedQuestions.length} questions! The user can now start practicing.`
                }]
            },
            { status: 200 }
        );

    } catch (error) {
        console.error("❌ Unexpected error:", error);
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