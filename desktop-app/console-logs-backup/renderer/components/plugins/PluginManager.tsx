/**
 * Plugin Manager Component - Main interface for managing plugins
 * 
 * Provides a comprehensive UI for browsing, installing, configuring,
 * and managing plugins in Flow Desk.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Card,
  Button,
  Input,
  Avatar,
  Badge,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  cn
} from '../ui';
import {
  Search,
  Filter,
  Download,
  Settings,
  Star,
  Shield,
  AlertCircle,
  CheckCircle,
  Clock,
  Trash2,
  Play,
  Pause,
  RefreshCw
} from 'lucide-react';
import { PluginInstallation, PluginManifest, PluginCategory, PluginType } from '@flow-desk/shared';

// Mock data for development
const mockInstalledPlugins: PluginInstallation[] = [
  {
    id: 'slack-plugin-install',
    userId: 'user-123',
    pluginId: 'com.flowdesk.slack',
    version: '1.2.0',
    status: 'active',
    config: {},
    settings: {
      enabled: true,
      autoUpdate: true,
      visible: true,
      order: 1,
      notifications: { enabled: true, types: ['mentions', 'messages'] }
    },
    grantedPermissions: ['network', 'notifications'],
    grantedScopes: ['user:read'],
    installedAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-01-20'),
    lastUsedAt: new Date('2024-01-25')
  }
];

const mockAvailablePlugins: PluginManifest[] = [
  {
    id: 'com.flowdesk.notion',
    name: 'Notion',
    version: '2.1.0',
    description: 'Connect your Notion workspace for seamless note-taking and project management',
    author: 'Flow Desk Team',
    license: 'MIT',
    type: 'panel',
    category: 'productivity',
    tags: ['notes', 'projects', 'collaboration'],
    icon: 'https://notion.so/icons/notion-icon.png',
    minFlowDeskVersion: '0.1.0',
    platforms: ['desktop'],
    permissions: ['network', 'storage'],
    scopes: ['user:read', 'files:read'],
    entrypoints: [{ type: 'main', file: 'index.js' }],
    capabilities: { search: true, notifications: true, oauth: true },
    marketplace: {
      published: true,
      pricing: { model: 'free' }
    },
    build: {
      buildTime: '2024-01-20T10:00:00Z',
      environment: 'production'
    }
  }
];

interface PluginManagerProps {
  className?: string;
}

export const PluginManager: React.FC<PluginManagerProps> = ({ className }) => {
  const [activeTab, setActiveTab] = useState<'installed' | 'marketplace'>('installed');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<PluginCategory | 'all'>('all');
  const [installedPlugins, setInstalledPlugins] = useState<PluginInstallation[]>(mockInstalledPlugins);
  const [availablePlugins, setAvailablePlugins] = useState<PluginManifest[]>(mockAvailablePlugins);
  const [selectedPlugin, setSelectedPlugin] = useState<PluginInstallation | PluginManifest | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Load installed plugins from the main process
  const loadInstalledPlugins = useCallback(async () => {
    setIsLoading(true);
    try {
      const plugins = await (window.flowDesk as any)?.pluginManager?.getInstalledPlugins?.() || mockInstalledPlugins;
      setInstalledPlugins(plugins);
    } catch (error) {
      console.error('Failed to load installed plugins:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load available plugins from marketplace
  const loadAvailablePlugins = useCallback(async () => {
    setIsLoading(true);
    try {
      const plugins = await (window.flowDesk as any)?.pluginManager?.searchPlugins({ 
        query: searchQuery,
        category: selectedCategory === 'all' ? undefined : selectedCategory
      }) || mockAvailablePlugins;
      setAvailablePlugins(plugins);
    } catch (error) {
      console.error('Failed to load available plugins:', error);
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, selectedCategory]);

  // Install plugin
  const installPlugin = useCallback(async (manifest: PluginManifest) => {
    setIsLoading(true);
    try {
      await (window.flowDesk as any)?.pluginManager?.installPlugin(manifest.id);
      await loadInstalledPlugins();
    } catch (error) {
      console.error('Failed to install plugin:', error);
    } finally {
      setIsLoading(false);
    }
  }, [loadInstalledPlugins]);

  // Uninstall plugin
  const uninstallPlugin = useCallback(async (installation: PluginInstallation) => {
    setIsLoading(true);
    try {
      await (window.flowDesk as any)?.pluginManager?.uninstallPlugin(installation.id);
      await loadInstalledPlugins();
    } catch (error) {
      console.error('Failed to uninstall plugin:', error);
    } finally {
      setIsLoading(false);
    }
  }, [loadInstalledPlugins]);

  // Toggle plugin enabled state
  const togglePlugin = useCallback(async (installation: PluginInstallation) => {
    setIsLoading(true);
    try {
      if (installation.settings.enabled) {
        await (window.flowDesk as any)?.pluginManager?.disablePlugin(installation.id);
      } else {
        await (window.flowDesk as any)?.pluginManager?.enablePlugin(installation.id);
      }
      await loadInstalledPlugins();
    } catch (error) {
      console.error('Failed to toggle plugin:', error);
    } finally {
      setIsLoading(false);
    }
  }, [loadInstalledPlugins]);

  // Filter plugins based on search and category
  const filteredInstalledPlugins = useMemo(() => {
    return installedPlugins.filter(plugin => {
      const matchesSearch = !searchQuery || 
        plugin.pluginId.toLowerCase().includes(searchQuery.toLowerCase());
      
      return matchesSearch;
    });
  }, [installedPlugins, searchQuery]);

  const filteredAvailablePlugins = useMemo(() => {
    return availablePlugins.filter(plugin => {
      const matchesSearch = !searchQuery || 
        plugin.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        plugin.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        plugin.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
      
      const matchesCategory = selectedCategory === 'all' || plugin.category === selectedCategory;
      
      // Don't show plugins that are already installed
      const notInstalled = !installedPlugins.some(installed => installed.pluginId === plugin.id);
      
      return matchesSearch && matchesCategory && notInstalled;
    });
  }, [availablePlugins, searchQuery, selectedCategory, installedPlugins]);

  useEffect(() => {
    loadInstalledPlugins();
  }, [loadInstalledPlugins]);

  useEffect(() => {
    if (activeTab === 'marketplace') {
      loadAvailablePlugins();
    }
  }, [activeTab, loadAvailablePlugins]);

  const getStatusIcon = (status: PluginInstallation['status']) => {
    switch (status) {
      case 'active': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'disabled': return <Pause className="h-4 w-4 text-gray-500" />;
      case 'error': return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'installing': return <Clock className="h-4 w-4 text-blue-500" />;
      case 'updating': return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />;
      default: return <AlertCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: PluginInstallation['status']) => {
    switch (status) {
      case 'active': return 'bg-green-500/10 text-green-400 border-green-500/20';
      case 'disabled': return 'bg-muted text-muted-foreground border-border';
      case 'error': return 'bg-red-500/10 text-red-400 border-red-500/20';
      case 'installing': case 'updating': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      default: return 'bg-muted text-muted-foreground border-border';
    }
  };

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Header */}
      <div className="flex-none p-6 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold">Plugin Manager</h1>
            <p className="text-sm text-muted-foreground">
              Manage your Flow Desk plugins and discover new ones
            </p>
          </div>
          <Button 
            variant="outline" 
            onClick={() => activeTab === 'installed' ? loadInstalledPlugins() : loadAvailablePlugins()}
            disabled={isLoading}
            leftIcon={<RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />}
          >
            Refresh
          </Button>
        </div>

        {/* Search and Filters */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search plugins..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          
          {activeTab === 'marketplace' && (
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value as PluginCategory | 'all')}
              className="px-3 py-2 border border-border rounded-md bg-background"
            >
              <option value="all">All Categories</option>
              <option value="communication">Communication</option>
              <option value="productivity">Productivity</option>
              <option value="development">Development</option>
              <option value="utilities">Utilities</option>
              <option value="finance">Finance</option>
            </select>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)} className="flex-1 flex flex-col">
        <TabsList className="mx-6 mt-4 mb-0">
          <TabsTrigger value="installed" className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4" />
            Installed ({installedPlugins.length})
          </TabsTrigger>
          <TabsTrigger value="marketplace" className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            Marketplace
          </TabsTrigger>
        </TabsList>

        {/* Installed Plugins */}
        <TabsContent value="installed" className="flex-1 p-6 pt-4">
          <div className="grid gap-4">
            {filteredInstalledPlugins.map((plugin) => (
              <Card key={plugin.id} className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <Avatar className="h-12 w-12">
                      <div className="w-full h-full bg-primary/10 flex items-center justify-center text-primary text-lg font-semibold">
                        {plugin.pluginId.charAt(0).toUpperCase()}
                      </div>
                    </Avatar>
                    
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold">{plugin.pluginId}</h3>
                        <Badge 
                          variant="outline" 
                          className={cn('text-xs', getStatusColor(plugin.status))}
                        >
                          {getStatusIcon(plugin.status)}
                          <span className="ml-1 capitalize">{plugin.status}</span>
                        </Badge>
                      </div>
                      
                      <p className="text-sm text-muted-foreground mb-2">
                        Version {plugin.version}
                      </p>
                      
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>Installed {plugin.installedAt.toLocaleDateString()}</span>
                        {plugin.lastUsedAt && (
                          <span>Last used {plugin.lastUsedAt.toLocaleDateString()}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => togglePlugin(plugin)}
                      disabled={isLoading}
                    >
                      {plugin.settings.enabled ? (
                        <>
                          <Pause className="h-4 w-4 mr-1" />
                          Disable
                        </>
                      ) : (
                        <>
                          <Play className="h-4 w-4 mr-1" />
                          Enable
                        </>
                      )}
                    </Button>
                    
                    <Button variant="outline" size="sm" onClick={() => setSelectedPlugin(plugin)}>
                      <Settings className="h-4 w-4 mr-1" />
                      Settings
                    </Button>
                    
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => uninstallPlugin(plugin)}
                      disabled={isLoading}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Uninstall
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
            
            {filteredInstalledPlugins.length === 0 && (
              <div className="text-center py-12">
                <div className="text-4xl mb-4">🔌</div>
                <h3 className="text-lg font-medium mb-2">No plugins installed</h3>
                <p className="text-muted-foreground mb-4">
                  {searchQuery ? 'No plugins match your search.' : 'Get started by installing plugins from the marketplace.'}
                </p>
                <Button onClick={() => setActiveTab('marketplace')}>
                  Browse Marketplace
                </Button>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Marketplace */}
        <TabsContent value="marketplace" className="flex-1 p-6 pt-4">
          <div className="grid gap-4">
            {filteredAvailablePlugins.map((plugin) => (
              <Card key={plugin.id} className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <Avatar className="h-12 w-12">
                      {plugin.icon ? (
                        <img src={plugin.icon} alt={plugin.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-primary/10 flex items-center justify-center text-primary text-lg font-semibold">
                          {plugin.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </Avatar>
                    
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold">{plugin.name}</h3>
                        <Badge variant="outline" className="text-xs">
                          {plugin.type}
                        </Badge>
                        {plugin.marketplace?.pricing.model === 'free' && (
                          <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                            Free
                          </Badge>
                        )}
                      </div>
                      
                      <p className="text-sm text-muted-foreground mb-2">
                        {plugin.description}
                      </p>
                      
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>v{plugin.version}</span>
                        <span>by {plugin.author}</span>
                        <div className="flex items-center gap-1">
                          <Shield className="h-3 w-3" />
                          <span>{plugin.permissions.length} permissions</span>
                        </div>
                      </div>
                      
                      {plugin.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {plugin.tags.slice(0, 3).map((tag) => (
                            <Badge key={tag} variant="secondary" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                          {plugin.tags.length > 3 && (
                            <Badge variant="secondary" className="text-xs">
                              +{plugin.tags.length - 3} more
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setSelectedPlugin(plugin)}>
                      View Details
                    </Button>
                    
                    <Button 
                      size="sm" 
                      onClick={() => installPlugin(plugin)}
                      disabled={isLoading}
                    >
                      <Download className="h-4 w-4 mr-1" />
                      Install
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
            
            {filteredAvailablePlugins.length === 0 && (
              <div className="text-center py-12">
                <div className="text-4xl mb-4">🔍</div>
                <h3 className="text-lg font-medium mb-2">No plugins found</h3>
                <p className="text-muted-foreground">
                  {searchQuery || selectedCategory !== 'all' 
                    ? 'Try adjusting your search criteria.' 
                    : 'The marketplace is currently empty.'}
                </p>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Plugin Details Dialog */}
      {selectedPlugin && (
        <Dialog open={!!selectedPlugin} onOpenChange={() => setSelectedPlugin(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  {'icon' in selectedPlugin && selectedPlugin.icon ? (
                    <img src={selectedPlugin.icon} alt={selectedPlugin.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
                      {('name' in selectedPlugin ? selectedPlugin.name : selectedPlugin.pluginId).charAt(0).toUpperCase()}
                    </div>
                  )}
                </Avatar>
                {'name' in selectedPlugin ? selectedPlugin.name : selectedPlugin.pluginId}
              </DialogTitle>
              <DialogDescription>
                {'description' in selectedPlugin ? selectedPlugin.description : 'Plugin configuration and details'}
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <strong>Version:</strong> {selectedPlugin.version}
                </div>
                <div>
                  <strong>Author:</strong> {'author' in selectedPlugin ? selectedPlugin.author : 'Unknown'}
                </div>
                {'permissions' in selectedPlugin && (
                  <div className="col-span-2">
                    <strong>Permissions:</strong>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {selectedPlugin.permissions.map((permission) => (
                        <Badge key={permission} variant="outline" className="text-xs">
                          {permission}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};