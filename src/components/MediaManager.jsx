import { useState } from 'react';
import { uploadMedia } from '../api/wordpress';

export default function MediaManager() {
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState('');

  const handleUpload = async () => {
    if (!file) return;
    try {
      setStatus('Uploading...');
      await uploadMedia(file);
      setStatus('Upload successful');
    } catch (err) {
      setStatus('Upload failed');
    }
  };

  return (
    <div className="p-4 border rounded" style={{ borderColor: 'var(--border)' }}>
      <input
        type="file"
        onChange={(e) => setFile(e.target.files[0])}
        className="mb-2"
      />
      <button
        onClick={handleUpload}
        className="px-4 py-2 bg-blue-500 text-white rounded"
      >
        Upload
      </button>
      {status && <p className="mt-2 text-sm">{status}</p>}
    </div>
  );
}
