import React from 'react';

export interface Attachment {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  downloadUrl?: string;
}

interface AttachmentListProps {
  attachments: Attachment[];
  onDownload?: (attachment: Attachment) => void;
  onPreview?: (attachment: Attachment) => void;
  compact?: boolean;
}

export default function AttachmentList({ 
  attachments, 
  onDownload, 
  onPreview, 
  compact = false 
}: AttachmentListProps) {
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (mimeType: string): string => {
    if (mimeType.startsWith('image/')) return '📷';
    if (mimeType.startsWith('video/')) return '📹';
    if (mimeType.startsWith('audio/')) return '🎵';
    if (mimeType.includes('pdf')) return '📄';
    if (mimeType.includes('word')) return '📝';
    if (mimeType.includes('excel')) return '📊';
    if (mimeType.includes('powerpoint')) return '📽️';
    return '📎';
  };

  if (attachments.length === 0) {
    return null;
  }

  return (
    <div className={`attachment-list ${compact ? 'compact' : ''}`}>
      {compact && (
        <div className="attachment-summary">
          📎 {attachments.length} attachment{attachments.length !== 1 ? 's' : ''}
        </div>
      )}
      
      {!compact && (
        <div className="attachment-items">
          {attachments.map((attachment) => (
            <div key={attachment.id} className="attachment-item">
              <div className="attachment-icon">
                {getFileIcon(attachment.mimeType)}
              </div>
              
              <div className="attachment-info">
                <div className="attachment-name" title={attachment.filename}>
                  {attachment.filename}
                </div>
                <div className="attachment-details">
                  {formatFileSize(attachment.size)} • {attachment.mimeType}
                </div>
              </div>
              
              <div className="attachment-actions">
                {onPreview && (
                  <button 
                    className="btn-preview"
                    onClick={() => onPreview(attachment)}
                    aria-label={`Preview ${attachment.filename}`}
                  >
                    👁️
                  </button>
                )}
                
                {onDownload && (
                  <button 
                    className="btn-download"
                    onClick={() => onDownload(attachment)}
                    aria-label={`Download ${attachment.filename}`}
                  >
                    ⬇️
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}