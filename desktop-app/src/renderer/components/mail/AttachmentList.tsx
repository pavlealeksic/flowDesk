import React from 'react';
import { cn } from '../ui/utils';
import { Button } from '../ui/Button';

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

  const getFileTypeColor = (mimeType: string): string => {
    if (mimeType.startsWith('image/')) return 'bg-green-50 border-green-200 text-green-700';
    if (mimeType.startsWith('video/')) return 'bg-purple-50 border-purple-200 text-purple-700';
    if (mimeType.startsWith('audio/')) return 'bg-blue-50 border-blue-200 text-blue-700';
    if (mimeType.includes('pdf')) return 'bg-red-50 border-red-200 text-red-700';
    if (mimeType.includes('word')) return 'bg-indigo-50 border-indigo-200 text-indigo-700';
    if (mimeType.includes('excel')) return 'bg-emerald-50 border-emerald-200 text-emerald-700';
    if (mimeType.includes('powerpoint')) return 'bg-orange-50 border-orange-200 text-orange-700';
    return 'bg-gray-50 border-gray-200 text-gray-700';
  };

  if (attachments.length === 0) {
    return null;
  }

  return (
    <div className={cn(
      "attachment-list",
      compact ? "compact" : "full"
    )}>
      {compact ? (
        <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200">
          <span className="text-sm" aria-hidden="true">📎</span>
          <span className="text-sm text-gray-700">
            {attachments.length} attachment{attachments.length !== 1 ? 's' : ''}
          </span>
        </div>
      ) : (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-900 mb-3">
            Attachments ({attachments.length})
          </h4>
          
          <div className="attachment-items space-y-2">
            {attachments.map((attachment) => (
              <div 
                key={attachment.id} 
                className={cn(
                  "attachment-item flex items-center gap-3 p-3 rounded-lg border transition-colors",
                  "hover:bg-gray-50",
                  getFileTypeColor(attachment.mimeType)
                )}
              >
                <div className="attachment-icon text-xl flex-shrink-0" aria-hidden="true">
                  {getFileIcon(attachment.mimeType)}
                </div>
                
                <div className="attachment-info flex-1 min-w-0">
                  <div 
                    className="attachment-name font-medium text-sm text-gray-900 truncate" 
                    title={attachment.filename}
                  >
                    {attachment.filename}
                  </div>
                  <div className="attachment-details text-xs text-gray-500 mt-1">
                    {formatFileSize(attachment.size)} • {attachment.mimeType.split('/')[1]?.toUpperCase() || 'FILE'}
                  </div>
                </div>
                
                <div className="attachment-actions flex items-center gap-1 flex-shrink-0">
                  {onPreview && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onPreview(attachment)}
                      aria-label={`Preview ${attachment.filename}`}
                      className="h-8 w-8 p-0 hover:bg-white/50"
                    >
                      <span className="text-sm">👁️</span>
                    </Button>
                  )}
                  
                  {onDownload && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDownload(attachment)}
                      aria-label={`Download ${attachment.filename}`}
                      className="h-8 w-8 p-0 hover:bg-white/50"
                    >
                      <span className="text-sm">⬇️</span>
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}