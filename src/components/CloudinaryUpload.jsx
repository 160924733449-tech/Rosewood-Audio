import React, { useState, useRef } from 'react';
import { UploadCloud, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { parseMetadata } from '../utils/metadataHelper';
import { db } from '../config/firebase';
import { doc, setDoc } from 'firebase/firestore';

export default function CloudinaryUpload({ onUploadComplete }) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState(''); // '', 'success', 'error'
  const [statusMessage, setStatusMessage] = useState('');
  
  const fileInputRef = useRef(null);
  
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

  const triggerSelect = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    if (!cloudName || cloudName === 'YOUR_CLOUD_NAME') {
      setUploadStatus('error');
      setStatusMessage('Cloudinary Cloud Name is missing in .env');
      return;
    }

    setIsUploading(true);
    setUploadStatus('');
    setStatusMessage('');
    
    let successCount = 0;
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setUploadProgress(Math.round((i / files.length) * 100));
      setStatusMessage(`Uploading ${file.name}...`);
      
      try {
        // 1. Parse Metadata
        let tags = { title: file.name.replace(/\.[^/.]+$/, ""), artist: "Unknown Artist", album: "Unknown Album" };
        try {
          const parsedTags = await parseMetadata(file);
          if (parsedTags) {
            tags = { ...tags, ...parsedTags };
          }
        } catch (err) {
          console.warn(`Failed to parse ID3 tags for ${file.name}`, err);
        }
        
        // 1.5 Start Artwork Upload in Parallel (Zero extra latency!)
        let artworkUrlPromise = Promise.resolve(null);
        if (tags && tags.artwork) {
          const artFormData = new FormData();
          artFormData.append('file', tags.artwork); // base64 data URI
          artFormData.append('upload_preset', uploadPreset);
          artworkUrlPromise = fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
            method: 'POST',
            body: artFormData
          }).then(res => res.ok ? res.json() : null)
            .then(data => data ? data.secure_url : null)
            .catch(err => {
              console.warn('Artwork upload failed:', err);
              return null;
            });
        }
        
        // 2. Upload to Cloudinary using Chunked Upload (Bypasses 10MB limit)
        const CHUNK_SIZE = 10000000; // 10MB chunks
        const uniqueUploadId = Math.random().toString(36).substring(2) + Date.now().toString(36);
        const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
        
        let secureUrl = null;
        let cloudData = null;

        for (let currentChunk = 0; currentChunk < totalChunks; currentChunk++) {
          const start = currentChunk * CHUNK_SIZE;
          const end = Math.min(start + CHUNK_SIZE, file.size);
          const chunk = file.slice(start, end);
          
          const formData = new FormData();
          formData.append('file', chunk);
          formData.append('upload_preset', uploadPreset);
          formData.append('resource_type', 'auto');
          
          const uploadResponse = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, {
            method: 'POST',
            headers: {
              'X-Unique-Upload-Id': uniqueUploadId,
              'Content-Range': `bytes ${start}-${end - 1}/${file.size}`
            },
            body: formData,
          });
          
          if (!uploadResponse.ok) {
            throw new Error(`Cloudinary upload failed at chunk ${currentChunk + 1}`);
          }
          
          const result = await uploadResponse.json();
          if (currentChunk === totalChunks - 1) {
            cloudData = result;
            secureUrl = cloudData.secure_url;
          }
        }
        
        // Wait for artwork to finish (usually finishes long before audio)
        const finalArtworkUrl = await artworkUrlPromise;
        
        // 3. Save to Firestore
        const trackId = `cloudinary:${cloudData.public_id.replace(/\//g, '_')}`;
        
        const trackMetadata = {
          id: trackId,
          name: file.name,
          title: tags.title,
          artist: tags.artist,
          album: tags.album,
          genre: tags.genre || 'Cloud Music',
          year: tags.year || '',
          size: file.size,
          mime: file.type || 'audio/mpeg',
          source: 'cloudinary',
          url: secureUrl, // Direct streaming URL
          artwork: finalArtworkUrl,
        };
        
        const trackRef = doc(db, 'libraryMetadata', trackId);
        await setDoc(trackRef, trackMetadata);
        
        successCount++;
        
      } catch (error) {
        console.error(`Error uploading ${file.name}:`, error);
      }
    }
    
    setUploadProgress(100);
    setIsUploading(false);
    
    if (successCount === files.length) {
      setUploadStatus('success');
      setStatusMessage(`Successfully uploaded ${successCount} track(s).`);
      if (onUploadComplete) onUploadComplete();
    } else {
      setUploadStatus('error');
      setStatusMessage(`Uploaded ${successCount}/${files.length} track(s). Some failed.`);
      if (successCount > 0 && onUploadComplete) onUploadComplete();
    }
    
    // Clear input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="cloudinary-upload-container">
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        accept="audio/*" 
        multiple 
        style={{ display: 'none' }} 
      />
      
      <button 
        className="menu-item" 
        onClick={triggerSelect} 
        disabled={isUploading}
        style={{ 
          background: 'rgba(213, 28, 57, 0.05)', 
          color: 'var(--accent-deep)', 
          border: '1px dashed var(--accent-rose)' 
        }}
      >
        {isUploading ? (
          <UploadCloud size={18} className="pulse" />
        ) : (
          <UploadCloud size={18} />
        )}
        <span>{isUploading ? 'Uploading...' : 'Upload to Cloud'}</span>
      </button>
      
      {isUploading && (
        <div className="upload-progress-bar" style={{ marginTop: '8px', background: 'rgba(255,255,255,0.1)', height: '4px', borderRadius: '2px', overflow: 'hidden' }}>
          <div style={{ width: `${uploadProgress}%`, background: 'var(--accent-rose)', height: '100%', transition: 'width 0.3s' }}></div>
        </div>
      )}
      
      {statusMessage && (
        <div className={`upload-status ${uploadStatus}`} style={{ marginTop: '8px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', color: uploadStatus === 'error' ? '#ff4a4a' : 'var(--text-secondary)' }}>
          {uploadStatus === 'success' && <CheckCircle size={14} color="var(--accent-coral)" />}
          {uploadStatus === 'error' && <AlertCircle size={14} color="#ff4a4a" />}
          <span>{statusMessage}</span>
        </div>
      )}
    </div>
  );
}
