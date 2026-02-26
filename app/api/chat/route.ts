import { NEWTON_SYSTEM_PROMPT } from "@/lib/system-prompt";
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

    const { message } = body as { message?: string };

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

    const requestBody = {
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: NEWTON_SYSTEM_PROMPT,
      messages: [{ role: "user", content: message }],
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
