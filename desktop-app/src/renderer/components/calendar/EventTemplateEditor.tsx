import React from 'react'

interface EventTemplateEditorProps {
  className?: string;
  onTemplateSelect?: (template: any) => void;
}

const EventTemplateEditor: React.FC<EventTemplateEditorProps> = ({ 
  className, 
  onTemplateSelect 
}) => {
  return (
    <div className={className}>
      <h3>Event Templates</h3>
      <p>Template editor functionality coming soon...</p>
    </div>
  )
}

export default EventTemplateEditor