'use client';

import { useState, useRef } from 'react';

interface MediaFile {
  id: string;
  file: File;
  url: string;
}

interface MediaUploadProps {
  onMediaChange: (files: File[]) => void;
  existingMedia?: File[];
}

export default function MediaUpload({ onMediaChange, existingMedia = [] }: MediaUploadProps) {
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>(() => 
    existingMedia.map((file, index) => ({
      id: `existing-${index}`,
      file,
      url: URL.createObjectURL(file)
    }))
  );
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const updateParent = (files: MediaFile[]) => {
    onMediaChange(files.map(m => m.file));
  };

  const handleFileSelect = (files: FileList | null) => {
    if (!files) return;

    const newFiles: MediaFile[] = [];
    Array.from(files).forEach((file) => {
      // Check file type
      if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
        alert(`${file.name} is not a supported media file. Please upload images or videos.`);
        return;
      }
      
      // Check file size (50MB limit)
      if (file.size > 50 * 1024 * 1024) {
        alert(`${file.name} is too large. Please upload files smaller than 50MB.`);
        return;
      }

      const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const url = URL.createObjectURL(file);
      
      newFiles.push({
        id,
        file,
        url
      });
    });

    const updatedFiles = [...mediaFiles, ...newFiles];
    setMediaFiles(updatedFiles);
    updateParent(updatedFiles);
  };

  const removeMedia = (id: string) => {
    const updated = mediaFiles.filter(media => media.id !== id);
    setMediaFiles(updated);
    updateParent(updated);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Media Attachments</h3>
        <span className="text-sm text-muted-foreground">
          {mediaFiles.length} file{mediaFiles.length !== 1 ? 's' : ''} selected
        </span>
      </div>
      
      <div
        className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
          isDragging ? 'border-accent bg-accent/5' : 'border-border hover:border-accent/50'
        }`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,video/*"
          onChange={(e) => handleFileSelect(e.target.files)}
          className="hidden"
        />
        
        <svg
          className="h-12 w-12 text-muted-foreground mx-auto mb-3"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2z"
          />
        </svg>
        
        <p className="text-sm font-medium mb-1">
          {isDragging ? 'Drop files here' : 'Drag photos/videos here or click to browse'}
        </p>
        <p className="text-xs text-muted-foreground">
          Supports images and videos (Max 50MB each)
        </p>
      </div>

      {mediaFiles.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {mediaFiles.map((media) => (
            <div key={media.id} className="relative group">
              <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden">
                {media.file.type.startsWith('image/') ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={media.url}
                    alt="Preview"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <video
                    src={media.url}
                    className="w-full h-full object-cover"
                    controls={false}
                    muted
                  />
                )}
              </div>
              
              <button
                onClick={() => removeMedia(media.id)}
                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              
              <div className="absolute bottom-2 left-2 right-2 bg-black/70 text-white text-xs p-1 rounded truncate">
                {media.file.name}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
