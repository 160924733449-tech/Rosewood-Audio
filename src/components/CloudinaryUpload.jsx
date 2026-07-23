import React, { useState, useRef } from 'react';
import { UploadCloud, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { parseMetadata } from '../utils/metadataHelper';
import { db } from '../config/firebase';
import { doc, setDoc } from 'firebase/firestore';

export default function CloudinaryUpload({ onUploadComplete }) {
  const [isUploading, setIsUploading] = useState(false);
  const [currentFileIndex, setCurrentFileIndex] = useState(0);
  const [totalFiles, setTotalFiles] = useState(0);
  const [chunkProgress, setChunkProgress] = useState(0);
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
    setTotalFiles(files.length);
    setCurrentFileIndex(0);
    setChunkProgress(0);
    
    let successCount = 0;
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setCurrentFileIndex(i + 1);
      setChunkProgress(0);
      setStatusMessage(`[UPLOADING] ${file.name}`);
      
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
          
          setChunkProgress(Math.round(((currentChunk + 1) / totalChunks) * 100));
          
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
          background: isUploading ? '#ccc' : '#000', 
          color: isUploading ? '#000' : '#fff', 
          border: '2px solid #000',
          fontFamily: 'monospace',
          fontWeight: 'bold',
          borderRadius: 0,
          textTransform: 'uppercase',
          justifyContent: 'center',
          cursor: isUploading ? 'not-allowed' : 'pointer'
        }}
      >
        <span>{isUploading ? 'SYS.UPLOADING...' : 'INITIATE UPLOAD'}</span>
      </button>
      
      {isUploading && (
        <div style={{ marginTop: '8px', border: '2px solid #000', background: '#fff', padding: '8px', fontFamily: 'monospace', color: '#000' }}>
          <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
            FILE {currentFileIndex} OF {totalFiles}
          </div>
          <div style={{ fontSize: '11px', wordBreak: 'break-all', marginBottom: '8px' }}>
            {statusMessage}
          </div>
          <div style={{ width: '100%', background: '#ccc', border: '1px solid #000', height: '12px', position: 'relative' }}>
            <div style={{ width: `${chunkProgress}%`, background: '#000', height: '100%', transition: 'width 0.1s' }}></div>
            <div style={{ position: 'absolute', top: '-1px', left: 0, width: '100%', textAlign: 'center', fontSize: '9px', color: chunkProgress > 50 ? '#fff' : '#000', fontWeight: 'bold' }}>
              {chunkProgress}%
            </div>
          </div>
        </div>
      )}
      
      {!isUploading && statusMessage && (
        <div style={{ marginTop: '8px', padding: '8px', border: '2px dashed #000', fontFamily: 'monospace', fontSize: '11px', background: uploadStatus === 'error' ? 'red' : '#fff', color: uploadStatus === 'error' ? '#fff' : '#000', fontWeight: 'bold' }}>
          {statusMessage}
        </div>
      )}
    </div>
  );
}
