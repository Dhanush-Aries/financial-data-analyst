"use client";

import { useCallback, useState } from "react";
import { Upload, FileText, X, CheckCircle } from "lucide-react";
import { ParsedData, parseFile } from "@/lib/fileParser";

interface FileUploadProps {
  onDataParsed: (data: ParsedData) => void;
  onError: (error: string) => void;
}

export default function FileUpload({ onDataParsed, onError }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<string | null>(null);

  const handleFile = useCallback(
    async (file: File) => {
      const extension = file.name.split(".").pop()?.toLowerCase();
      if (!["csv", "pdf"].includes(extension || "")) {
        onError("Only CSV and PDF files are supported");
        return;
      }

      setIsLoading(true);
      setUploadedFile(null);
      try {
        const parsed = await parseFile(file);
        setUploadedFile(file.name);
        onDataParsed(parsed);
      } catch (err) {
        onError(err instanceof Error ? err.message : "Failed to parse file");
      } finally {
        setIsLoading(false);
      }
    },
    [onDataParsed, onError]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
      // Reset input so same file can be re-uploaded
      e.target.value = "";
    },
    [handleFile]
  );

  const clearFile = () => {
    setUploadedFile(null);
  };

  return (
    <div className="w-full">
      <label
        className={`flex flex-col items-center justify-center w-full h-36 border-2 border-dashed rounded-xl cursor-pointer transition-all duration-200 ${
          isDragging
            ? "border-primary bg-primary/5 scale-[1.01]"
            : uploadedFile
            ? "border-green-400 bg-green-50"
            : "border-border bg-muted/30 hover:bg-muted/60 hover:border-muted-foreground/40"
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
      >
        <input
          type="file"
          accept=".csv,.pdf"
          className="hidden"
          onChange={handleInputChange}
          disabled={isLoading}
        />

        {isLoading ? (
          <div className="flex flex-col items-center gap-2">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            <p className="text-sm text-muted-foreground">Parsing file...</p>
          </div>
        ) : uploadedFile ? (
          <div className="flex flex-col items-center gap-2">
            <CheckCircle className="h-8 w-8 text-green-500" />
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium text-green-700 max-w-[200px] truncate">
                {uploadedFile}
              </span>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  clearFile();
                }}
                className="text-muted-foreground hover:text-destructive"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Click to upload a different file
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Upload
              className={`h-8 w-8 ${
                isDragging ? "text-primary" : "text-muted-foreground"
              }`}
            />
            <div className="text-center">
              <p className="text-sm font-medium text-foreground">
                Drop your file here, or{" "}
                <span className="text-primary">browse</span>
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Supports CSV and PDF files
              </p>
            </div>
          </div>
        )}
      </label>
    </div>
  );
}
