import { NextRequest, NextResponse } from "next/server";

// This route handles file upload and delegates to the analyze route for actual parsing.
// CSV files are parsed client-side via papaparse; PDFs are parsed server-side via /api/analyze.
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const extension = file.name.split(".").pop()?.toLowerCase();
    if (!["csv", "pdf"].includes(extension || "")) {
      return NextResponse.json(
        { error: "Only CSV and PDF files are supported" },
        { status: 400 }
      );
    }

    const sizeLimit = 10 * 1024 * 1024; // 10 MB
    if (file.size > sizeLimit) {
      return NextResponse.json(
        { error: "File size exceeds 10 MB limit" },
        { status: 413 }
      );
    }

    // For PDFs, forward to /api/analyze for server-side text extraction
    if (extension === "pdf") {
      const proxyFormData = new FormData();
      proxyFormData.append("file", file);

      const analyzeUrl = new URL("/api/analyze", req.url);
      const analyzeRes = await fetch(analyzeUrl.toString(), {
        method: "POST",
        body: proxyFormData,
      });

      if (!analyzeRes.ok) {
        const err = await analyzeRes.json();
        return NextResponse.json(
          { error: err.error || "PDF parsing failed" },
          { status: analyzeRes.status }
        );
      }

      const data = await analyzeRes.json();
      return NextResponse.json(data);
    }

    // For CSV, return metadata — actual parsing happens client-side via papaparse
    return NextResponse.json({
      fileType: "csv",
      fileName: file.name,
      size: file.size,
      message: "CSV files are parsed client-side. Use the fileParser utility.",
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 500 }
    );
  }
}
