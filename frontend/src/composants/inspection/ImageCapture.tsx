"use client";

import { useRef, useState } from "react";

interface ImageCaptureProps {
  onImageSelected: (file: File) => void;
  selectedImage: File | null;
}

export default function ImageCapture({ onImageSelected, selectedImage }: ImageCaptureProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const handleFileChange = (file: File | null) => {
    if (file && file.type.startsWith("image/")) {
      onImageSelected(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files[0];
    handleFileChange(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = () => {
    setDragActive(false);
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-800">
        Image du document
      </h3>
      
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all ${
          dragActive
            ? "border-blue-500 bg-blue-50"
            : "border-gray-300 bg-gray-50 hover:border-blue-400"
        }`}
      >
        {preview ? (
          <div className="space-y-4">
            <img
              src={preview}
              alt="Aperçu"
              className="max-h-64 mx-auto rounded-lg shadow-md"
            />
            <p className="text-sm text-gray-600">
              Cliquez ou glissez pour remplacer
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="text-4xl">📷</div>
            <p className="text-gray-700 font-medium">
              Cliquez ou glissez une image ici
            </p>
            <p className="text-sm text-gray-500">
              JPG, PNG, WEBP ou TIFF (max 15 Mo)
            </p>
          </div>
        )}
        
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/tiff"
          className="hidden"
          onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
        />
      </div>
    </div>
  );
}