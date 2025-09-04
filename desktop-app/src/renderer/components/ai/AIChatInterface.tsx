import React from 'react';

export interface AIMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'function' | 'tool';
  content: string;
  timestamp: Date;
  name?: string;
}

export interface AIProvider {
  id: string;
  name: string;
  isHealthy: boolean;
  hasApiKey: boolean;
  models: string[];
}

export interface AIChatInterfaceProps {
  className?: string;
  providers?: Array<{
    id: string;
    name: string;
    models: string[];
    isHealthy: boolean;
    hasApiKey: boolean;
  }>;
  currentProvider?: string;
  currentModel?: string;
  onProviderChange?: (providerId: string) => void;
  onModelChange?: (model: string) => void;
  onSend?: (message: string) => void;
  onSendMessage?: (message: string) => void;
  isLoading?: boolean;
  onSettingsOpen?: () => void;
  messages?: AIMessage[];
}

export const AIChatInterface: React.FC<AIChatInterfaceProps> = ({ className }) => {
  return (
    <div className={className}>
      <div>AI Chat Interface</div>
      <p>Chat interface will be implemented here</p>
    </div>
  );
};

export default AIChatInterface;
