import Papa from "papaparse";

export interface ParsedData {
  headers: string[];
  rows: Record<string, string>[];
  rawText: string;
  fileType: "csv" | "pdf";
  fileName: string;
}

export async function parseCSV(file: File): Promise<ParsedData> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const headers = results.meta.fields || [];
        const rows = results.data as Record<string, string>[];
        // Build a concise text representation for Claude
        const rawText = [
          `CSV File: ${file.name}`,
          `Columns: ${headers.join(", ")}`,
          `Rows: ${rows.length}`,
          "",
          // Include first 50 rows as sample
          Papa.unparse(rows.slice(0, 50), { header: true }),
        ].join("\n");

        resolve({
          headers,
          rows,
          rawText,
          fileType: "csv",
          fileName: file.name,
        });
      },
      error: (error) => reject(new Error(`CSV parse error: ${error.message}`)),
    });
  });
}

export async function parsePDF(file: File): Promise<ParsedData> {
  // Send to API route for server-side PDF parsing
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch("/api/analyze", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to parse PDF");
  }

  const data = await response.json();
  return {
    headers: [],
    rows: [],
    rawText: data.text,
    fileType: "pdf",
    fileName: file.name,
  };
}

export async function parseFile(file: File): Promise<ParsedData> {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension === "csv") {
    return parseCSV(file);
  } else if (extension === "pdf") {
    return parsePDF(file);
  }
  throw new Error(`Unsupported file type: .${extension}`);
}
