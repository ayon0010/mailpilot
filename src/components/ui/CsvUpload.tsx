"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";

export default function CsvUploader() {
  const [uploading, setUploading] = useState(false);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    try {
      setUploading(true);

      const res = await fetch("/api/leads/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Upload failed");
      }

      console.log("Upload successful:", data);
    } catch (error) {
      console.error(error);
    } finally {
      setUploading(false);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      "text/csv": [".csv"],
    },
    maxFiles: 1,
    onDrop,
  });

  return (
    <div
      {...getRootProps()}
      className="cursor-pointer rounded-lg border-2 border-dashed p-8 text-center"
    >
      <input {...getInputProps()} />

      {uploading ? (
        <p>Uploading...</p>
      ) : isDragActive ? (
        <p>Drop the CSV here…</p>
      ) : (
        <p>Drag & drop a CSV file here, or click to select one.</p>
      )}
    </div>
  );
}
