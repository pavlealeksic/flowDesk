/**
 * Create Workspace Modal Component
 * 
 * Allows users to create new workspaces with custom name, icon, color, and browser isolation settings
 */

import React, { useState } from 'react';
import { Button, Input, Card, cn } from '../ui';

interface CreateWorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateWorkspace: (workspace: {
    name: string;
    icon: string;
    color: string;
    browserIsolation: 'shared' | 'isolated';
  }) => void;
}

export const CreateWorkspaceModal: React.FC<CreateWorkspaceModalProps> = ({
  isOpen,
  onClose,
  onCreateWorkspace
}) => {
  const [formData, setFormData] = useState({
    name: '',
    icon: '', // No default icon - user uploads their own
    color: '#4285f4',
    browserIsolation: 'shared' as 'shared' | 'isolated'
  });

  const [isCreating, setIsCreating] = useState(false);

  // Generate 2-letter abbreviation from name (safe for empty input)
  const generateAbbreviation = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return '??';
    
    const words = trimmed.split(/\s+/);
    if (words.length === 1) {
      return words[0].substring(0, 2).toUpperCase();
    } else {
      return (words[0][0] + (words[1]?.[0] || words[0][1] || '')).toUpperCase();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    setIsCreating(true);
    try {
      await onCreateWorkspace(formData);
      setFormData({
        name: '',
        icon: '🏢',
        color: '#4285f4',
        browserIsolation: 'shared'
      });
      onClose();
    } catch (error) {
      console.error('Failed to create workspace:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const predefinedColors = [
    '#4285f4', // Blue
    '#0f9d58', // Green  
    '#f4b400', // Yellow
    '#db4437', // Red
    '#ab47bc', // Purple
    '#00acc1', // Cyan
    '#ff7043', // Orange
    '#8bc34a', // Light Green
    '#9c27b0', // Deep Purple
    '#607d8b'  // Blue Grey
  ];

  // Icons are now custom image uploads

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <Card className="w-80 max-w-sm mx-4">
        <form onSubmit={handleSubmit} className="p-4 space-y-3 max-h-[80vh] overflow-y-auto">
          <div>
            <h2 className="text-xl font-semibold mb-2">Create New Workspace</h2>
            <p className="text-sm text-muted-foreground">
              Set up a new workspace to organize your tools and services
            </p>
          </div>

          {/* Workspace Name */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Workspace Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => {
                const value = e.target.value;
                console.log('Name changed to:', value);
                setFormData(prev => ({ ...prev, name: value }));
              }}
              placeholder="e.g., Personal, Work, Project Alpha"
              required
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground"
            />
            {formData.name && (
              <p className="text-xs text-muted-foreground">
                Sidebar abbreviation: <span className="font-mono font-bold">{generateAbbreviation(formData.name)}</span>
              </p>
            )}
          </div>

          {/* Workspace Icon (Optional) */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Icon (Optional)</label>
            <div className="flex items-center space-x-3">
              <div className="flex-1">
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      // Create object URL for preview
                      const imageUrl = URL.createObjectURL(file);
                      setFormData(prev => ({ ...prev, icon: imageUrl }));
                    }
                  }}
                  className="text-sm"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Optional: Upload JPG, PNG, or SVG. If not provided, shows abbreviation.
                </p>
              </div>
              
              {/* Icon Preview */}
              <div className="w-12 h-12 rounded-lg border bg-muted/30 flex items-center justify-center overflow-hidden">
                {formData.icon ? (
                  <img src={formData.icon} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-sm font-bold text-white" style={{ backgroundColor: formData.color }}>
                    {generateAbbreviation(formData.name)}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Workspace Color */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Color</label>
            <div className="flex flex-wrap gap-2">
              {predefinedColors.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={cn(
                    'w-8 h-8 rounded-full border-2 hover:scale-110 transition-transform',
                    formData.color === color ? 'border-foreground' : 'border-border'
                  )}
                  style={{ backgroundColor: color }}
                  onClick={() => setFormData(prev => ({ ...prev, color }))}
                />
              ))}
            </div>
            
            {/* Custom color input */}
            <Input
              type="color"
              value={formData.color}
              onChange={(e) => setFormData(prev => ({ ...prev, color: e.target.value }))}
              className="w-full h-10"
            />
          </div>

          {/* Browser Isolation */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Browser Sessions</label>
            <div className="flex space-x-4">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="radio"
                  name="browserIsolation"
                  value="shared"
                  checked={formData.browserIsolation === 'shared'}
                  onChange={(e) => setFormData(prev => ({ ...prev, browserIsolation: e.target.value as 'shared' }))}
                  className="w-4 h-4"
                />
                <span className="text-sm">Shared</span>
              </label>
              
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="radio"
                  name="browserIsolation"
                  value="isolated"
                  checked={formData.browserIsolation === 'isolated'}
                  onChange={(e) => setFormData(prev => ({ ...prev, browserIsolation: e.target.value as 'isolated' }))}
                  className="w-4 h-4"
                />
                <span className="text-sm">Isolated</span>
              </label>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-3">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isCreating}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!formData.name.trim() || isCreating}
              onClick={() => console.log('Button clicked, formData.name:', formData.name, 'trimmed:', formData.name.trim())}
            >
              {isCreating ? 'Creating...' : 'Create Workspace'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};

export default CreateWorkspaceModal;