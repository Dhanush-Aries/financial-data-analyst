import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

// Server-side PDF parsing using pdf-parse
async function extractPDFText(buffer: Buffer): Promise<string> {
  // pdf-parse must be imported dynamically to avoid issues with Next.js
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParse = require("pdf-parse");
  const data = await pdfParse(buffer);
  return data.text;
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const extension = file.name.split(".").pop()?.toLowerCase();

    // Handle PDF parsing
    if (extension === "pdf") {
      const buffer = Buffer.from(await file.arrayBuffer());
      const text = await extractPDFText(buffer);
      return NextResponse.json({ text, fileType: "pdf", fileName: file.name });
    }

    return NextResponse.json(
      { error: "Use /api/chat for analysis after parsing" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Analyze error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Analysis failed" },
      { status: 500 }
    );
  }
}

// Quick summary generation with Haiku
export async function PUT(req: NextRequest) {
  try {
    const { fileContent, fileName } = await req.json();

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    // Use claude-haiku-4-5-20251001 for quick initial parsing/summarization
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system: [
        {
          type: "text",
          text: "You are a financial data analyst. Provide a concise summary of the uploaded data in 3-5 bullet points. Focus on: number of records, key columns/metrics, date ranges if present, and what financial analysis is possible.",
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [
        {
          role: "user",
          content: `File: ${fileName}\n\nContent:\n${fileContent.slice(0, 4000)}`,
        },
      ],
    });

    const text = response.content.find((b) => b.type === "text");
    return NextResponse.json({ summary: text?.text ?? "" });
  } catch (error) {
    console.error("Summary error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Summary failed" },
      { status: 500 }
    );
  }
}
