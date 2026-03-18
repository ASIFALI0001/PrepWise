"use client";

import Image from "next/image";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

import { cn } from "@/lib/utils";
import { vapi } from "@/lib/vapi.sdk";
import { interviewer } from "@/constants";
import { createFeedback } from "@/lib/actions/general.action";

enum CallStatus {
    INACTIVE = "INACTIVE",
    CONNECTING = "CONNECTING",
    ACTIVE = "ACTIVE",
    FINISHED = "FINISHED",
}

interface SavedMessage {
    role: "user" | "system" | "assistant";
    content: string;
}

const Agent = ({
                   userName,
                   userId,
                   interviewId,
                   feedbackId,
                   type,
                   questions,
               }: AgentProps) => {
    const router = useRouter();
    const [callStatus, setCallStatus] = useState<CallStatus>(CallStatus.INACTIVE);
    const [messages, setMessages] = useState<SavedMessage[]>([]);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [lastMessage, setLastMessage] = useState<string>("");

    useEffect(() => {
        const onCallStart = () => setCallStatus(CallStatus.ACTIVE);
        const onCallEnd = () => setCallStatus(CallStatus.FINISHED);

        const onMessage = (message: any) => {
            if (message.type === "transcript" && message.transcriptType === "final") {
                const newMessage = { role: message.role, content: message.transcript };
                setMessages((prev) => [...prev, newMessage]);
            }
        };

        const onSpeechStart = () => setIsSpeaking(true);
        const onSpeechEnd = () => setIsSpeaking(false);
        const onError = (error: any) => console.log("❌ Vapi Error:", JSON.stringify(error, null, 2));

        vapi.on("call-start", onCallStart);
        vapi.on("call-end", onCallEnd);
        vapi.on("message", onMessage);
        vapi.on("speech-start", onSpeechStart);
        vapi.on("speech-end", onSpeechEnd);
        vapi.on("error", onError);

        return () => {
            vapi.off("call-start", onCallStart);
            vapi.off("call-end", onCallEnd);
            vapi.off("message", onMessage);
            vapi.off("speech-start", onSpeechStart);
            vapi.off("speech-end", onSpeechEnd);
            vapi.off("error", onError);
        };
    }, []);

    useEffect(() => {
        if (messages.length > 0) {
            setLastMessage(messages[messages.length - 1].content);
        }

        const handleGenerateFeedback = async (messages: SavedMessage[]) => {
            console.log("🎯 Generating feedback...");
            if (!interviewId || !userId) return;

            const { success, feedbackId: id } = await createFeedback({
                interviewId,
                userId,
                transcript: messages,
                feedbackId,
            });

            if (success && id) {
                router.push(`/interview/${interviewId}/feedback`);
            } else {
                console.error("❌ Feedback generation failed");
                router.push("/");
            }
        };

        if (callStatus === CallStatus.FINISHED) {
            if (type === "generate") {
                router.push("/");
            } else {
                handleGenerateFeedback(messages);
            }
        }
    }, [messages, callStatus, feedbackId, interviewId, router, type, userId]);

    const handleCall = async () => {
        if (!userId) return;
        setCallStatus(CallStatus.CONNECTING);

        try {
            if (type === "generate") {
                // ✅ Generate interview flow
                await vapi.start({
                    transcriber: {
                        provider: "deepgram",
                        model: "nova-2",
                        language: "en-US",
                    },
                    model: {
                        provider: "openai",
                        model: "gpt-4o",
                        messages: [
                            {
                                role: "system",
                                content: `You are PrepWise, a professional and friendly AI interview coach.
Your goal is to collect interview details from the user and save them.

Your behavior:
- Be encouraging, warm, and professional at all times
- Only ask ONE question at a time
- Wait for the COMPLETE answer before moving to next question
- Listen carefully and confirm what the user said before moving on
- Keep responses short and conversational
- Do NOT generate interview questions yourself
- Do NOT rush — wait for clear answers

Collect the following details IN ORDER, one at a time:
1. Ask if they are ready to start — wait for YES
2. Ask for their target job role — wait for answer, confirm it back
3. Ask for the interview type (technical, behavioral, or mixed) — wait for answer
4. Ask for their experience level (Junior, Mid-level, or Senior) — wait for answer
5. Ask for their tech stack or relevant skills — wait for answer
6. Ask EXACTLY how many questions they want (must be a number between 1 and 30) — wait for a CLEAR NUMBER

IMPORTANT for question 6:
- Make sure you get a clear number from the user
- If they say "a few" or "some", ask them to give a specific number
- Confirm the number back to them before proceeding

Once ALL 6 details are clearly collected and confirmed, IMMEDIATELY call the generateInterview function with:
- role: the job role
- type: technical, behavioral, or mixed
- level: Junior, Mid-level, or Senior
- techstack: the technologies mentioned
- amount: THE EXACT NUMBER the user said
- userid: ${userId}

After calling the function, say EXACTLY:
"Your interview has been created successfully! Head over to your dashboard to start practicing. Best of luck! Goodbye!"
Then end the call.

The user's name is ${userName} and their userId is ${userId}.`,
                            },
                        ],
                        functions: [
                            {
                                name: "generateInterview",
                                description: "Saves the interview details and generates questions",
                                parameters: {
                                    type: "object",
                                    properties: {
                                        role: { type: "string", description: "The job role" },
                                        type: { type: "string", description: "technical, behavioral, or mixed" },
                                        level: { type: "string", description: "Junior, Mid-level, or Senior" },
                                        techstack: { type: "string", description: "Technologies to cover" },
                                        amount: { type: "number", description: "EXACT number of questions the user requested" },
                                        userid: { type: "string", description: "The user ID" },
                                    },
                                    required: ["role", "type", "level", "techstack", "amount", "userid"],
                                },
                            },
                        ],
                        temperature: 0.5,
                        maxTokens: 1000,
                    },
                    voice: {
                        provider: "11labs",
                        voiceId: "sarah",
                    },
                    firstMessage: `Hello ${userName}! Welcome to PrepWise. I'm here to help you set up your interview practice session. Are you ready to get started?`,
                    serverUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/vapi/generate`,
                });
            } else {
                // ✅ Take interview flow — uses questions from Firebase
                let formattedQuestions = "";
                if (questions && questions.length > 0) {
                    formattedQuestions = questions
                        .map((q, i) => `${i + 1}. ${q}`)
                        .join("\n");
                }

                console.log("📝 Starting interview with questions:", formattedQuestions);

                await vapi.start(interviewer, {
                    variableValues: {
                        questions: formattedQuestions,
                    },
                });
            }
        } catch (error: any) {
            console.error("❌ Vapi start error:", error);
            setCallStatus(CallStatus.INACTIVE);
        }
    };

    const handleDisconnect = () => {
        setCallStatus(CallStatus.FINISHED);
        vapi.stop();
    };

    return (
        <>
            <div className="call-view">
                <div className="card-interviewer">
                    <div className="avatar">
                        <Image
                            src="/ai-avatar.png"
                            alt="profile-image"
                            width={65}
                            height={54}
                            className="object-cover"
                        />
                        {isSpeaking && <span className="animate-speak" />}
                    </div>
                    <h3>AI Interviewer</h3>
                </div>

                <div className="card-border">
                    <div className="card-content">
                        <Image
                            src="/user-avatar.png"
                            alt="profile-image"
                            width={539}
                            height={539}
                            className="rounded-full object-cover size-[120px]"
                        />
                        <h3>{userName}</h3>
                    </div>
                </div>
            </div>

            {messages.length > 0 && (
                <div className="transcript-border">
                    <div className="transcript">
                        <p
                            key={lastMessage}
                            className={cn(
                                "transition-opacity duration-500 opacity-0",
                                "animate-fadeIn opacity-100"
                            )}
                        >
                            {lastMessage}
                        </p>
                    </div>
                </div>
            )}

            <div className="w-full flex justify-center">
                {callStatus !== "ACTIVE" ? (
                    <button className="relative btn-call" onClick={handleCall}>
                        <span
                            className={cn(
                                "absolute animate-ping rounded-full opacity-75",
                                callStatus !== "CONNECTING" && "hidden"
                            )}
                        />
                        <span className="relative">
                            {callStatus === "INACTIVE" || callStatus === "FINISHED"
                                ? "Call"
                                : "..."}
                        </span>
                    </button>
                ) : (
                    <button className="btn-disconnect" onClick={handleDisconnect}>
                        End
                    </button>
                )}
            </div>
        </>
    );
};

export default Agent;