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
- Only ask one question at a time
- Wait for the user's response before moving to the next question
- Keep responses short and conversational
- Do NOT generate interview questions yourself

Collect the following details in order:
1. Ask if they are ready to start
2. Ask for their target job role
3. Ask for the interview type (technical, behavioral, or mixed)
4. Ask for their experience level (Junior, Mid-level, or Senior)
5. Ask for their tech stack or relevant skills
6. Ask how many questions they want (between 1 and 30)

Once ALL details are collected, IMMEDIATELY call the generateInterview function with all values.
Do NOT tell the user you are generating questions.
Do NOT wait after calling the function.
After the function is called successfully, say EXACTLY:
"Your interview has been created successfully! Head over to your dashboard to start practicing. Best of luck! Goodbye!"
Then end the call.

The user's name is ${userName} and their userId is ${userId}.`,
                            },
                        ],
                        functions: [
                            {
                                name: "generateInterview",
                                description: "Saves the interview details to the database",
                                parameters: {
                                    type: "object",
                                    properties: {
                                        role: { type: "string", description: "The job role" },
                                        type: { type: "string", description: "technical, behavioral, or mixed" },
                                        level: { type: "string", description: "Junior, Mid-level, or Senior" },
                                        techstack: { type: "string", description: "Technologies to cover" },
                                        amount: { type: "number", description: "Number of questions" },
                                        userid: { type: "string", description: "The user ID" },
                                    },
                                    required: ["role", "type", "level", "techstack", "amount", "userid"],
                                },
                            },
                        ],
                        temperature: 0.5,
                        maxTokens: 250,
                    },
                    voice: {
                        provider: "11labs",
                        voiceId: "sarah",
                    },
                    firstMessage: `Hello ${userName}! Welcome to PrepWise. I'm here to help you set up your interview practice session. Are you ready to get started?`,
                    serverUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/vapi/generate`,
                });
            } else {
                let formattedQuestions = "";
                if (questions) {
                    formattedQuestions = questions.map((q) => `- ${q}`).join("\n");
                }

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