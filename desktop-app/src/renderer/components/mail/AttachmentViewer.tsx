import React, { useState, useCallback, useEffect } from 'react'
import {
  Button,
  Card,
  cn,
  X,
  Download,
  Eye,
  FileText,
  Image as ImageIcon,
  File,
  Loader2,
  AlertCircle,
  Maximize2,
  Minimize2
} from '../ui'

interface EmailAttachment {
  id: string
  filename: string
  size: number
  mimeType: string
  isInline: boolean
  contentId?: string
  data?: string // Base64 encoded data
}

interface AttachmentViewerProps {
  attachment: EmailAttachment
  onClose: () => void
  onDownload: (attachment: EmailAttachment) => void
  className?: string
}

const formatFileSize = (bytes: number): string => {
  const kb = bytes / 1024
  if (kb < 1024) return `${Math.round(kb)} KB`
  const mb = kb / 1024
  return `${Math.round(mb * 10) / 10} MB`
}

const getFileIcon = (mimeType: string): React.ReactNode => {
  if (mimeType.startsWith('image/')) {
    return <ImageIcon className="h-8 w-8 text-blue-500" />
  } else if (mimeType === 'application/pdf') {
    return <FileText className="h-8 w-8 text-red-500" />
  } else if (mimeType.startsWith('text/')) {
    return <FileText className="h-8 w-8 text-green-500" />
  } else {
    return <File className="h-8 w-8 text-gray-500" />
  }
}

const ImagePreview: React.FC<{ attachment: EmailAttachment }> = ({ attachment }) => {
  const [imageError, setImageError] = useState(false)
  const [imageLoading, setImageLoading] = useState(true)

  if (!attachment.data) {
    return (
      <div className="flex items-center justify-center h-64 bg-muted/30 rounded-lg">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No preview available</p>
        </div>
      </div>
    )
  }

  if (imageError) {
    return (
      <div className="flex items-center justify-center h-64 bg-muted/30 rounded-lg">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-2" />
          <p className="text-sm text-destructive">Failed to load image</p>
        </div>
      </div>
    )
  }

  const imageUrl = `data:${attachment.mimeType};base64,${attachment.data}`

  return (
    <div className="flex items-center justify-center bg-muted/30 rounded-lg overflow-hidden">
      {imageLoading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}
      <img
        src={imageUrl}
        alt={attachment.filename}
        className="max-w-full max-h-96 object-contain"
        onLoad={() => setImageLoading(false)}
        onError={() => {
          setImageLoading(false)
          setImageError(true)
        }}
      />
    </div>
  )
}

const PDFPreview: React.FC<{ attachment: EmailAttachment }> = ({ attachment }) => {
  if (!attachment.data) {
    return (
      <div className="flex items-center justify-center h-64 bg-muted/30 rounded-lg">
        <div className="text-center">
          <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">PDF preview not available</p>
          <p className="text-xs text-muted-foreground mt-1">Download to view</p>
        </div>
      </div>
    )
  }

  const pdfUrl = `data:${attachment.mimeType};base64,${attachment.data}`

  return (
    <div className="h-96 w-full border border-border rounded-lg overflow-hidden">
      <iframe
        src={pdfUrl}
        className="w-full h-full"
        title={`PDF: ${attachment.filename}`}
        sandbox="allow-same-origin"
      />
    </div>
  )
}

const TextPreview: React.FC<{ attachment: EmailAttachment }> = ({ attachment }) => {
  const [textContent, setTextContent] = useState<string>('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (attachment.data) {
      try {
        const content = atob(attachment.data)
        setTextContent(content)
      } catch (error) {
        setTextContent('Failed to decode text content')
      }
    }
    setLoading(false)
  }, [attachment.data])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    )
  }

  return (
    <div className="border border-border rounded-lg">
      <div className="p-2 bg-muted border-b border-border">
        <span className="text-xs font-mono text-muted-foreground">
          {attachment.filename}
        </span>
      </div>
      <div className="p-4 max-h-64 overflow-y-auto">
        <pre className="text-sm whitespace-pre-wrap font-mono text-foreground">
          {textContent.length > 5000 
            ? textContent.substring(0, 5000) + '\n\n... (truncated, download to view full content)'
            : textContent
          }
        </pre>
      </div>
    </div>
  )
}

export const AttachmentViewer: React.FC<AttachmentViewerProps> = ({
  attachment,
  onClose,
  onDownload,
  className
}) => {
  const [isMinimized, setIsMinimized] = useState(false)

  const handleDownload = useCallback(() => {
    onDownload(attachment)
  }, [attachment, onDownload])

  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      onClose()
    }
  }, [onClose])

  const renderPreview = () => {
    if (attachment.mimeType.startsWith('image/')) {
      return <ImagePreview attachment={attachment} />
    } else if (attachment.mimeType === 'application/pdf') {
      return <PDFPreview attachment={attachment} />
    } else if (attachment.mimeType.startsWith('text/')) {
      return <TextPreview attachment={attachment} />
    } else {
      return (
        <div className="flex flex-col items-center justify-center h-64 bg-muted/30 rounded-lg">
          {getFileIcon(attachment.mimeType)}
          <p className="text-sm font-medium mt-4">{attachment.filename}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {attachment.mimeType} • {formatFileSize(attachment.size)}
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            Preview not available for this file type
          </p>
        </div>
      )
    }
  }

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-labelledby="attachment-viewer-title"
    >
      <Card 
        className={cn(
          'w-full max-w-4xl transition-all duration-200',
          isMinimized ? 'max-h-[60px]' : 'max-h-[90vh]',
          className
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border">
            <div className="flex items-center gap-3">
              {getFileIcon(attachment.mimeType)}
              <div>
                <h2 id="attachment-viewer-title" className="text-lg font-semibold">
                  {attachment.filename}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {attachment.mimeType} • {formatFileSize(attachment.size)}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDownload}
                title="Download attachment"
              >
                <Download className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsMinimized(!isMinimized)}
                title={isMinimized ? "Maximize" : "Minimize"}
              >
                {isMinimized ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                title="Close viewer"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Preview Content */}
          {!isMinimized && (
            <div className="flex-1 p-4 min-h-0 overflow-auto">
              {renderPreview()}
            </div>
          )}
          
          {/* Footer Actions */}
          {!isMinimized && (
            <div className="flex items-center justify-between p-4 border-t border-border">
              <div className="text-sm text-muted-foreground">
                {attachment.isInline ? 'Inline attachment' : 'Regular attachment'}
              </div>
              
              <div className="flex items-center gap-2">
                <Button variant="ghost" onClick={onClose}>
                  Close
                </Button>
                <Button onClick={handleDownload}>
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}

export default AttachmentViewer