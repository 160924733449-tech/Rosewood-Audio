import React, { useState, useRef, useEffect } from 'react';
import { UploadCloud, CheckCircle, XCircle, AlertCircle, Loader2 } from 'lucide-react';
import { parseMetadata, enrichQuranTrack } from '../utils/metadataHelper';
import { db } from '../config/firebase';
import { doc, setDoc, collection, getDocs } from 'firebase/firestore';

export default function CloudinaryUpload({ onUploadComplete }) {
  // --- QUEUE STATE ---
  const [uploadQueue, setUploadQueue] = useState([]); 
  const [activeUploads, setActiveUploads] = useState(0);
  const [chunkProgressMap, setChunkProgressMap] = useState({});

  const [showDirectInput, setShowDirectInput] = useState(false);
  const [directUrl, setDirectUrl] = useState('');
  const [isPrivateUpload, setIsPrivateUpload] = useState(false);
  
  const fileInputRef = useRef(null);
  
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

  const normalizeStr = (str) => {
    if (!str) return '';
    let cleaned = str.replace(/^[0-9\s.\-_]+/, '');
    if (!cleaned) cleaned = str;
    return cleaned.toLowerCase().replace(/[^a-z0-9]/g, '');
  };

  // --- ENQUEUE FILES ---
  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    if (!cloudName || cloudName === 'YOUR_CLOUD_NAME') {
      alert('Cloudinary Cloud Name is missing in .env');
      return;
    }

    const newItems = files.map(file => {
      let displayName = file.name;
      if (!isPrivateUpload) {
        const enriched = enrichQuranTrack({ name: file.name, title: file.name.replace(/\.[^/.]+$/, "") });
        if (enriched.title) displayName = enriched.title;
      }
      
      return {
        id: `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: 'file',
        data: file,
        name: file.name,
        displayName,
        folder: isPrivateUpload ? 'private' : 'public',
        status: 'pending',
        errorMsg: ''
      };
    });

    setUploadQueue(prev => [...prev, ...newItems]);
    
    // Clear input so same files can be selected again if needed
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // --- ENQUEUE DIRECT URLS ---
  const handleAddDirectUrl = async (e) => {
    e.preventDefault();
    if (!directUrl.trim()) return;

    const urls = directUrl.split('\n').map(u => u.trim()).filter(u => u);
    
    const newItems = urls.map((url, i) => {
      let extractedName = url.substring(url.lastIndexOf('/') + 1) || `track_${Date.now()}.mp3`;
      if (extractedName.includes('?')) extractedName = extractedName.split('?')[0];

      let displayName = extractedName;
      if (!isPrivateUpload) {
        const enriched = enrichQuranTrack({ name: extractedName, title: extractedName.replace(/\.[^/.]+$/, "") });
        if (enriched.title) displayName = enriched.title;
      }

      return {
        id: `url_${Date.now()}_${i}_${Math.random().toString(36).substr(2, 9)}`,
        type: 'url',
        data: url,
        name: extractedName,
        displayName,
        folder: isPrivateUpload ? 'private' : 'public',
        status: 'pending',
        errorMsg: ''
      };
    });

    setUploadQueue(prev => [...prev, ...newItems]);
    setDirectUrl('');
    setShowDirectInput(false);
  };

  // --- QUEUE PROCESSOR ENGINE ---
  useEffect(() => {
    const processNext = async () => {
      if (activeUploads >= 1) return; // Process 1 at a time to prevent rate-limiting

      const nextIndex = uploadQueue.findIndex(item => item.status === 'pending');
      if (nextIndex === -1) return; // Nothing to process

      const item = uploadQueue[nextIndex];

      // Mark as uploading
      setUploadQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'uploading' } : q));
      setActiveUploads(prev => prev + 1);

      try {
        if (item.type === 'file') {
          await processFileUpload(item.data, item.folder, item.id);
        } else if (item.type === 'url') {
          await processUrlUpload(item.data, item.folder, item.id);
        }
        
        // Mark as success
        setUploadQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'success' } : q));
        if (onUploadComplete) onUploadComplete();
      } catch (err) {
        console.error(`Upload failed for ${item.name}:`, err);
        setUploadQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'error', errorMsg: err.message } : q));
      } finally {
        setActiveUploads(prev => Math.max(0, prev - 1));
      }
    };

    processNext();
  }, [uploadQueue, activeUploads]);

  // --- PROCESSING LOGIC ---
  const processUrlUpload = async (url, folder, itemId) => {
    let extractedName = url.substring(url.lastIndexOf('/') + 1) || `track_${Date.now()}.mp3`;
    if (extractedName.includes('?')) extractedName = extractedName.split('?')[0];
    
    const cleanName = extractedName.replace(/\.[^/.]+$/, "");
    let tags = { title: cleanName, artist: "Unknown Artist", album: "Unknown Album", genre: "Cloud Music" };
    
    let trackMetadata = {
      id: `cloudinary:direct_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      name: extractedName,
      title: tags.title,
      artist: tags.artist,
      album: tags.album,
      genre: tags.genre,
      year: '',
      size: 110000000,
      mime: 'audio/mpeg',
      source: 'cloudinary',
      url: url,
      artwork: null,
      createdAt: Date.now(),
      folder: folder
    };

    if (folder === 'public') {
      trackMetadata = enrichQuranTrack(trackMetadata);
    }

    const trackRef = doc(db, 'libraryMetadata', trackMetadata.id);
    await setDoc(trackRef, trackMetadata);
  };

  const processFileUpload = async (file, folder, itemId) => {
    setChunkProgressMap(prev => ({ ...prev, [itemId]: 0 }));

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
    
    // 2. Duplicate Check
    const snap = await getDocs(collection(db, 'libraryMetadata'));
    let duplicate = false;
    const fileKey = `${file.name}_${file.size}`;
    const tagKey = `${normalizeStr(tags.title)}_${normalizeStr(tags.artist)}`;
    
    snap.forEach(d => {
      const data = d.data();
      if (data.name === file.name && data.size === file.size) duplicate = true;
      if (tags.title && tags.artist && tags.artist !== 'Unknown Artist') {
        const fp = `${normalizeStr(data.title)}_${normalizeStr(data.artist)}`;
        if (fp.length > 3 && fp === tagKey) duplicate = true;
      }
    });

    if (duplicate) {
      console.log(`Skipped duplicate file: ${file.name}`);
      setChunkProgressMap(prev => ({ ...prev, [itemId]: 100 }));
      return; // Resolves cleanly, marked as success
    }

    // 3. Start Artwork Upload
    let artworkUrlPromise = Promise.resolve(null);
    if (tags && tags.artwork) {
      const artFormData = new FormData();
      artFormData.append('file', tags.artwork);
      artFormData.append('upload_preset', uploadPreset);
      artworkUrlPromise = fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
        method: 'POST',
        body: artFormData
      }).then(res => res.ok ? res.json() : null)
        .then(data => data ? data.secure_url : null)
        .catch(() => null);
    }

    // 4. Chunked Audio Upload
    const CHUNK_SIZE = 10000000; // 10MB
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
      
      setChunkProgressMap(prev => ({ ...prev, [itemId]: Math.round(((currentChunk + 1) / totalChunks) * 100) }));
      
      const result = await uploadResponse.json();
      if (currentChunk === totalChunks - 1) {
        cloudData = result;
        secureUrl = cloudData.secure_url;
      }
    }

    const finalArtworkUrl = await artworkUrlPromise;

    // 5. Save to Firestore
    const trackId = `cloudinary:${cloudData.public_id.replace(/\//g, '_')}`;
    
    let trackMetadata = {
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
      url: secureUrl,
      artwork: finalArtworkUrl,
      createdAt: Date.now(),
      folder: folder
    };
    
    if (folder === 'public') {
      trackMetadata = enrichQuranTrack(trackMetadata);
    }
    
    await setDoc(doc(db, 'libraryMetadata', trackId), trackMetadata);
  };

  const triggerSelect = () => {
    if (fileInputRef.current) fileInputRef.current.click();
  };

  return (
    <div className="cloudinary-upload-container">
      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginBottom: '8px', color: 'var(--text-secondary)', fontSize: '13px' }}>
        <input 
          type="checkbox" 
          checked={isPrivateUpload} 
          onChange={(e) => setIsPrivateUpload(e.target.checked)} 
        />
        Upload to Secret Private Folder (Pink Theme)
      </label>

      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        accept="audio/*" 
        multiple 
        style={{ display: 'none' }} 
      />
      
      <div style={{ display: 'flex', gap: '4px' }}>
        <button 
          className="menu-item" 
          onClick={triggerSelect} 
          style={{ 
            flex: 1,
            background: '#000', 
            color: '#fff', 
            border: '1px solid var(--accent-coral)',
            fontFamily: 'monospace',
            fontWeight: 'bold',
            borderRadius: 0,
            textTransform: 'uppercase',
            justifyContent: 'center',
            cursor: 'pointer',
            padding: '8px'
          }}
        >
          <span>INITIATE UPLOAD</span>
        </button>
        
        <button 
          type="button"
          onClick={() => setShowDirectInput(!showDirectInput)} 
          style={{ 
            background: showDirectInput ? 'var(--accent-coral)' : 'transparent', 
            color: showDirectInput ? '#000' : 'var(--accent-coral)', 
            border: '1px solid var(--accent-coral)',
            fontFamily: 'monospace',
            fontWeight: 'bold',
            cursor: 'pointer',
            padding: '8px 12px',
            fontSize: '14px'
          }}
        >
          <span>{showDirectInput ? '-' : '+'} URL</span>
        </button>
      </div>

      {showDirectInput && (
        <form onSubmit={handleAddDirectUrl} style={{ marginTop: '8px', padding: '10px', border: '1px solid var(--accent-coral)', background: 'rgba(0,0,0,0.8)', display: 'flex', flexDirection: 'column', gap: '8px', textAlign: 'left' }}>
          <div style={{ fontSize: '11px', color: 'var(--accent-coral)', fontFamily: 'monospace', lineHeight: '1.4' }}>
            <strong>HOW TO LINK &gt;100MB SURAHS:</strong><br />
            1. Upload to <a href="https://console.cloudinary.com/console/media_library" target="_blank" rel="noreferrer" style={{ color: '#fff', textDecoration: 'underline' }}>Cloudinary Dashboard</a>.<br />
            2. Paste Secure URLs below (one per line). Filenames are extracted automatically!
          </div>
          <textarea 
            placeholder="Paste Cloudinary Audio URLs (one per line)&#10;https://.../001.mp3&#10;https://.../002.mp3" 
            value={directUrl}
            onChange={(e) => setDirectUrl(e.target.value)}
            required
            rows={4}
            style={{ padding: '6px', background: '#111', border: '1px solid #444', color: '#fff', fontSize: '11px', fontFamily: 'monospace', resize: 'vertical' }}
          />
          <button 
            type="submit" 
            style={{ background: 'var(--accent-coral)', color: '#000', border: 'none', padding: '8px', fontWeight: 'bold', fontFamily: 'monospace', cursor: 'pointer', textTransform: 'uppercase' }}
          >
            ADD TO QUEUE
          </button>
        </form>
      )}
      
      {/* QUEUE STATUS UI */}
      {uploadQueue.length > 0 && (
        <div style={{ marginTop: '12px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', padding: '8px', maxHeight: '150px', overflowY: 'auto' }}>
          <div style={{ fontSize: '11px', fontWeight: 'bold', marginBottom: '8px', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between' }}>
            <span>UPLOAD QUEUE ({uploadQueue.filter(q => q.status === 'success').length}/{uploadQueue.length})</span>
            {activeUploads > 0 && <Loader2 size={12} className="spin" style={{ color: 'var(--accent-coral)' }} />}
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {uploadQueue.slice().reverse().map((item, idx) => (
              <div key={item.id} style={{ fontSize: '10px', fontFamily: 'monospace', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px', background: 'rgba(0,0,0,0.2)' }}>
                <span style={{ 
                  whiteSpace: 'nowrap', 
                  overflow: 'hidden', 
                  textOverflow: 'ellipsis', 
                  flex: 1,
                  minWidth: 0,
                  marginRight: '8px',
                  color: item.status === 'error' ? 'var(--accent-rose)' : 'var(--text-primary)'
                }}>
                  {item.displayName || item.name}
                </span>
                
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', minWidth: '40px', justifyContent: 'flex-end', flexShrink: 0 }}>
                  {item.status === 'pending' && <span style={{ color: 'var(--text-muted)' }}>WAITING</span>}
                  {item.status === 'uploading' && (
                    <span style={{ color: 'var(--accent-coral)' }}>
                      {item.type === 'file' ? `${chunkProgressMap[item.id] || 0}%` : 'LINKING'}
                    </span>
                  )}
                  {item.status === 'success' && <CheckCircle size={10} color="#4ade80" />}
                  {item.status === 'error' && <XCircle size={10} color="var(--accent-rose)" title={item.errorMsg} />}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
