import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are an expert financial data analyst. You help users understand their financial data by providing insightful analysis and visualizations.

When analyzing data, you should:
1. Provide clear, actionable insights about trends, patterns, and anomalies
2. Suggest appropriate visualizations when they would help understanding
3. Use specific numbers and percentages from the data
4. Highlight important financial metrics and KPIs

CHART GENERATION:
When you detect that a chart would help the user understand the data, include a JSON block at the END of your response in this exact format:

\`\`\`chart
{
  "type": "line|bar|pie|area|scatter|radar",
  "title": "Chart Title",
  "data": [...],
  "xKey": "column_name",
  "yKey": "column_name",
  "description": "Brief description of what this chart shows"
}
\`\`\`

Chart type guidelines:
- line: Time series, trends over time
- bar: Comparisons between categories
- pie: Distribution/proportions (use only when <= 8 categories)
- area: Cumulative trends, stacked comparisons
- scatter: Correlations between two numeric variables
- radar: Multi-dimensional comparisons (e.g., comparing multiple metrics)

For the data array, use the actual values from the dataset. Keep it to at most 20 data points for clarity.
Example data formats:
- Line/Bar/Area: [{"month": "Jan", "revenue": 50000}, {"month": "Feb", "revenue": 62000}]
- Pie: [{"name": "Product A", "value": 30}, {"name": "Product B", "value": 70}]
- Scatter: [{"x": 1000, "y": 2500, "label": "Q1"}]
- Radar: [{"subject": "Revenue", "A": 120, "B": 110}, {"subject": "Expenses", "A": 98, "B": 130}]

Always respond helpfully even if no chart is needed.`;

export async function POST(req: NextRequest) {
  try {
    const { messages, fileContent, fileName } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: "Invalid messages format" },
        { status: 400 }
      );
    }

    // Build conversation history for Claude
    const claudeMessages: Anthropic.MessageParam[] = messages.map(
      (m: { role: string; content: string }) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })
    );

    // If file content is provided, prepend it to the first user message context
    if (fileContent && fileName && claudeMessages.length > 0) {
      // Find the last user message and add file context if not already there
      const lastUserIdx = claudeMessages.findLastIndex(
        (m) => m.role === "user"
      );
      if (lastUserIdx !== -1) {
        const originalContent =
          typeof claudeMessages[lastUserIdx].content === "string"
            ? claudeMessages[lastUserIdx].content
            : "";
        // Only add file context to first user message
        if (lastUserIdx === 0) {
          claudeMessages[0].content = `[Data from ${fileName}]\n${fileContent}\n\n[User Question]\n${originalContent}`;
        }
      }
    }

    // Use claude-sonnet-4-6 for deep analysis with streaming
    const stream = client.messages.stream({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: claudeMessages,
    });

    // Return a streaming response
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              const chunk = encoder.encode(event.delta.text);
              controller.enqueue(chunk);
            }
          }
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
    });

    return new NextResponse(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Chat error:", error);
    if (error instanceof Anthropic.RateLimitError) {
      return NextResponse.json({ error: "Rate limited" }, { status: 429 });
    }
    if (error instanceof Anthropic.AuthenticationError) {
      return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Chat failed" },
      { status: 500 }
    );
  }
}
