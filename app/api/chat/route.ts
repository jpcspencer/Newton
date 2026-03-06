import { KEPLER_SYSTEM_PROMPT } from "@/lib/system-prompt";
import { createClient } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch((parseError) => {
      console.error("[Chat API] Failed to parse request body:", parseError);
      return null;
    });

    if (!body || typeof body !== "object") {
      console.error("[Chat API] Invalid request body:", body);
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const { message, displayName, articleContext, messages: conversationHistory } = body as {
      message?: string;
      displayName?: string | null;
      articleContext?: { title?: string; keplerSummary?: string; keplersInsight?: string | null };
      messages?: Array<{ role: "user" | "assistant"; content: string }>;
    };

    if (!message || typeof message !== "string") {
      console.error("[Chat API] Missing or invalid message:", { hasMessage: !!message, type: typeof message });
      return NextResponse.json(
        { error: "message is required and must be a string" },
        { status: 400 }
      );
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.error("[Chat API] ANTHROPIC_API_KEY is not configured");
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY is not configured" },
        { status: 500 }
      );
    }

    let systemPrompt = KEPLER_SYSTEM_PROMPT;
    try {
      const supabase = await createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const metadata = session?.user?.user_metadata;
      const interests = metadata?.interests;
      const userName = typeof metadata?.display_name === "string" ? metadata.display_name.trim() : null;
      if (Array.isArray(interests) && interests.length > 0) {
        const validInterests = interests.filter((i): i is string => typeof i === "string");
        if (validInterests.length > 0) {
          let userContext = `The user has saved interests: ${validInterests.join(", ")}. When relevant, tailor your responses and Kepler's Insight to draw connections to these areas. If they care about AI and Neuroscience, for example, surface those connections naturally. Do not force it — only when the connection is genuine and adds value.`;
          if (userName) {
            userContext += ` The user's name is ${userName}. You may reference them naturally by name when it feels appropriate.`;
          }
          systemPrompt = `${KEPLER_SYSTEM_PROMPT}

## User Context
${userContext}`;
        }
      } else if (userName) {
        systemPrompt = `${KEPLER_SYSTEM_PROMPT}

## User Context
The user's name is ${userName}. You may reference them naturally by name when it feels appropriate.`;
      }
    } catch {
      // Fall back to default system prompt
    }

    if (articleContext && (articleContext.title || articleContext.keplerSummary)) {
      const ctx = [
        articleContext.title && `Title: ${articleContext.title}`,
        articleContext.keplerSummary && `Summary: ${articleContext.keplerSummary}`,
        articleContext.keplersInsight && `Kepler's Insight: ${articleContext.keplersInsight}`,
      ]
        .filter(Boolean)
        .join("\n");
      systemPrompt = `${systemPrompt}

## Article Context (the user is asking about this specific story)
${ctx}
Answer in the context of this article. Do not add a "Kepler's Insight" header or section in your replies — write clean conversational prose and weave insights naturally.`;
    }

    const apiMessages: Array<{ role: "user" | "assistant"; content: string }> = Array.isArray(conversationHistory)
      ? [...conversationHistory, { role: "user" as const, content: message }]
      : [{ role: "user" as const, content: message }];

    const requestBody = {
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: systemPrompt,
      messages: apiMessages,
    };

    console.log("[Chat API] Calling Anthropic API...", { model: requestBody.model, messageLength: message.length });

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(requestBody),
    });

    const responseText = await response.text();

    if (!response.ok) {
      console.error("[Chat API] Anthropic API error:", {
        status: response.status,
        statusText: response.statusText,
        body: responseText,
      });
      let errorDetails: unknown;
      try {
        errorDetails = JSON.parse(responseText);
      } catch {
        errorDetails = responseText;
      }
      return NextResponse.json(
        {
          error: `Anthropic API error: ${response.status} ${response.statusText}`,
          details: errorDetails,
        },
        { status: response.status }
      );
    }

    const data = JSON.parse(responseText) as {
      content?: Array<{ type: string; text?: string }>;
    };

    const textContent = data.content?.find((block) => block.type === "text");
    const responseTextContent = textContent?.text ?? "";

    return NextResponse.json({ response: responseTextContent });
  } catch (error) {
    console.error("[Chat API] Unexpected error:", error);
    if (error instanceof Error) {
      console.error("[Chat API] Error stack:", error.stack);
    }
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
