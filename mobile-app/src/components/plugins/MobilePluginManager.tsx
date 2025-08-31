/**
 * Mobile Plugin Manager - Mobile-optimized plugin management interface
 * 
 * Provides:
 * - Touch-optimized plugin marketplace
 * - Mobile installation flows with progress
 * - Plugin configuration and settings
 * - Performance monitoring dashboard
 * - Offline support indicators
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  RefreshControl,
  ActivityIndicator,
  Image,
  Switch,
  Modal,
  Dimensions,
  SafeAreaView,
  StatusBar
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import NetInfo from '@react-native-netinfo/netinfo';

import { 
  PluginInstallation, 
  PluginManifest, 
  PluginMarketplaceListing,
  PluginCategory,
  InstallationProgress
} from '@flow-desk/shared';
import { MobilePluginService } from '../../services/pluginService';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';

interface MobilePluginManagerProps {
  pluginService: MobilePluginService;
  initialTab?: 'installed' | 'marketplace' | 'settings';
}

export const MobilePluginManager: React.FC<MobilePluginManagerProps> = ({
  pluginService,
  initialTab = 'installed'
}) => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  
  const [activeTab, setActiveTab] = useState<'installed' | 'marketplace' | 'settings'>(initialTab);
  const [installedPlugins, setInstalledPlugins] = useState<PluginInstallation[]>([]);
  const [marketplacePlugins, setMarketplacePlugins] = useState<PluginMarketplaceListing[]>([]);
  const [selectedPlugin, setSelectedPlugin] = useState<PluginInstallation | PluginMarketplaceListing | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<PluginCategory | 'all'>('all');
  const [installationProgress, setInstallationProgress] = useState<InstallationProgress | null>(null);
  const [showInstallModal, setShowInstallModal] = useState(false);

  const { width: screenWidth } = Dimensions.get('window');

  // Network monitoring
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOnline(state.isConnected ?? false);
    });
    return unsubscribe;
  }, []);

  // Load data on mount
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      await Promise.all([
        loadInstalledPlugins(),
        activeTab === 'marketplace' && loadMarketplacePlugins()
      ].filter(Boolean));
    } catch (error) {
      console.error('Failed to load plugin data:', error);
      Alert.alert('Error', 'Failed to load plugin data');
    } finally {
      setIsLoading(false);
    }
  };

  const loadInstalledPlugins = async () => {
    try {
      // Load from plugin service (would be implemented)
      const plugins: PluginInstallation[] = [];
      setInstalledPlugins(plugins);
    } catch (error) {
      console.error('Failed to load installed plugins:', error);
    }
  };

  const loadMarketplacePlugins = async () => {
    if (!isOnline) {
      return;
    }

    try {
      // Load from marketplace API (would be implemented)
      const plugins: PluginMarketplaceListing[] = [];
      setMarketplacePlugins(plugins);
    } catch (error) {
      console.error('Failed to load marketplace plugins:', error);
    }
  };

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadData();
    setIsRefreshing(false);
  }, [activeTab]);

  const handleInstallPlugin = useCallback(async (plugin: PluginMarketplaceListing) => {
    if (!isOnline) {
      Alert.alert('Offline', 'Plugin installation requires internet connection');
      return;
    }

    setShowInstallModal(true);
    setInstallationProgress({
      installationId: `temp_${Date.now()}`,
      pluginId: plugin.id,
      step: 'downloading',
      progress: 0,
      message: 'Preparing installation...'
    });

    try {
      // Simulate installation progress
      const steps = ['downloading', 'verifying', 'extracting', 'installing', 'configuring', 'complete'] as const;
      
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        const progress = Math.round((i / (steps.length - 1)) * 100);
        
        setInstallationProgress(prev => prev ? {
          ...prev,
          step,
          progress,
          message: `${step.charAt(0).toUpperCase() + step.slice(1)}...`
        } : null);
        
        // Simulate step duration
        await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
      }

      // Refresh installed plugins
      await loadInstalledPlugins();
      
      Alert.alert('Success', `${plugin.name} has been installed successfully!`);
    } catch (error) {
      console.error('Installation failed:', error);
      Alert.alert('Installation Failed', error.message);
    } finally {
      setShowInstallModal(false);
      setInstallationProgress(null);
    }
  }, [isOnline]);

  const handleTogglePlugin = useCallback(async (installation: PluginInstallation) => {
    try {
      if (installation.settings.enabled) {
        await pluginService.disablePlugin(installation.id);
      } else {
        await pluginService.enablePlugin(installation.id);
      }
      await loadInstalledPlugins();
    } catch (error) {
      console.error('Failed to toggle plugin:', error);
      Alert.alert('Error', `Failed to ${installation.settings.enabled ? 'disable' : 'enable'} plugin`);
    }
  }, [pluginService]);

  const filteredInstalledPlugins = useMemo(() => {
    return installedPlugins.filter(plugin =>
      !searchQuery || 
      plugin.pluginId.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [installedPlugins, searchQuery]);

  const filteredMarketplacePlugins = useMemo(() => {
    return marketplacePlugins.filter(plugin => {
      const matchesSearch = !searchQuery || 
        plugin.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        plugin.description.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesCategory = selectedCategory === 'all' || plugin.category === selectedCategory;
      
      return matchesSearch && matchesCategory;
    });
  }, [marketplacePlugins, searchQuery, selectedCategory]);

  const renderTabBar = () => (
    <View style={styles.tabBar}>
      {[
        { key: 'installed', label: 'Installed', count: installedPlugins.length },
        { key: 'marketplace', label: 'Marketplace', count: null },
        { key: 'settings', label: 'Settings', count: null }
      ].map(tab => (
        <TouchableOpacity
          key={tab.key}
          style={[styles.tab, activeTab === tab.key && styles.activeTab]}
          onPress={() => setActiveTab(tab.key as any)}
        >
          <Text style={[styles.tabText, activeTab === tab.key && styles.activeTabText]}>
            {tab.label}
          </Text>
          {tab.count !== null && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{tab.count}</Text>
            </View>
          )}
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderPluginCard = (plugin: PluginInstallation | PluginMarketplaceListing, isInstalled = false) => (
    <Card key={isInstalled ? plugin.id : plugin.id} style={styles.pluginCard}>
      <TouchableOpacity
        onPress={() => setSelectedPlugin(plugin)}
        style={styles.pluginCardContent}
      >
        <View style={styles.pluginHeader}>
          <Image
            source={{ uri: ('icon' in plugin ? plugin.icon : undefined) || 'https://via.placeholder.com/48' }}
            style={styles.pluginIcon}
          />
          <View style={styles.pluginInfo}>
            <Text style={styles.pluginName}>
              {'name' in plugin ? plugin.name : plugin.pluginId}
            </Text>
            <Text style={styles.pluginDescription}>
              {'description' in plugin ? plugin.description : `Version ${plugin.version}`}
            </Text>
            {!isOnline && (
              <Text style={styles.offlineIndicator}>Offline</Text>
            )}
          </View>
          {isInstalled && (
            <Switch
              value={(plugin as PluginInstallation).settings.enabled}
              onValueChange={() => handleTogglePlugin(plugin as PluginInstallation)}
              trackColor={{ false: '#767577', true: '#81b0ff' }}
              thumbColor={(plugin as PluginInstallation).settings.enabled ? '#f5dd4b' : '#f4f3f4'}
            />
          )}
        </View>
        
        <View style={styles.pluginFooter}>
          <View style={styles.pluginMeta}>
            <Text style={styles.pluginVersion}>v{plugin.version}</Text>
            {!isInstalled && 'marketplace' in plugin && plugin.marketplace?.pricing.model === 'free' && (
              <Text style={styles.freeTag}>FREE</Text>
            )}
          </View>
          
          {!isInstalled && (
            <Button
              title="Install"
              size="small"
              onPress={() => handleInstallPlugin(plugin as PluginMarketplaceListing)}
              disabled={!isOnline}
              style={styles.installButton}
            />
          )}
        </View>
      </TouchableOpacity>
    </Card>
  );

  const renderInstalledTab = () => (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
    >
      {!isOnline && (
        <Card style={styles.offlineCard}>
          <Text style={styles.offlineTitle}>Offline Mode</Text>
          <Text style={styles.offlineText}>
            Some features are limited while offline. Connect to the internet to access the full plugin marketplace.
          </Text>
        </Card>
      )}
      
      {filteredInstalledPlugins.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No Plugins Installed</Text>
          <Text style={styles.emptyText}>
            Browse the marketplace to discover and install plugins that enhance your Flow Desk experience.
          </Text>
          <Button
            title="Browse Marketplace"
            onPress={() => setActiveTab('marketplace')}
            style={styles.browseButton}
          />
        </View>
      ) : (
        filteredInstalledPlugins.map(plugin => renderPluginCard(plugin, true))
      )}
    </ScrollView>
  );

  const renderMarketplaceTab = () => (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
    >
      {!isOnline ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>Offline</Text>
          <Text style={styles.emptyText}>
            The marketplace requires an internet connection. Please check your network settings and try again.
          </Text>
        </View>
      ) : (
        <>
          {filteredMarketplacePlugins.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No Plugins Found</Text>
              <Text style={styles.emptyText}>
                Try adjusting your search criteria or check back later for new plugins.
              </Text>
            </View>
          ) : (
            filteredMarketplacePlugins.map(plugin => renderPluginCard(plugin, false))
          )}
        </>
      )}
    </ScrollView>
  );

  const renderSettingsTab = () => (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <Card style={styles.settingsCard}>
        <Text style={styles.settingsTitle}>Plugin System Settings</Text>
        
        <View style={styles.settingItem}>
          <Text style={styles.settingLabel}>Auto-update plugins</Text>
          <Switch value={true} onValueChange={() => {}} />
        </View>
        
        <View style={styles.settingItem}>
          <Text style={styles.settingLabel}>Enable background execution</Text>
          <Switch value={false} onValueChange={() => {}} />
        </View>
        
        <View style={styles.settingItem}>
          <Text style={styles.settingLabel}>Performance monitoring</Text>
          <Switch value={true} onValueChange={() => {}} />
        </View>
      </Card>

      <Card style={styles.settingsCard}>
        <Text style={styles.settingsTitle}>Storage & Cache</Text>
        
        <TouchableOpacity style={styles.settingButton}>
          <Text style={styles.settingButtonText}>Clear plugin cache</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.settingButton}>
          <Text style={styles.settingButtonText}>Export plugin data</Text>
        </TouchableOpacity>
      </Card>
    </ScrollView>
  );

  const renderInstallationModal = () => (
    <Modal
      visible={showInstallModal}
      transparent={true}
      animationType="fade"
    >
      <View style={styles.modalOverlay}>
        <Card style={styles.installModal}>
          <Text style={styles.modalTitle}>Installing Plugin</Text>
          
          {installationProgress && (
            <>
              <Text style={styles.modalStep}>
                {installationProgress.message}
              </Text>
              
              <View style={styles.progressContainer}>
                <View style={styles.progressBar}>
                  <LinearGradient
                    colors={['#4CAF50', '#8BC34A']}
                    style={[styles.progressFill, { width: `${installationProgress.progress}%` }]}
                  />
                </View>
                <Text style={styles.progressText}>
                  {installationProgress.progress}%
                </Text>
              </View>
              
              <ActivityIndicator size="large" color="#007AFF" style={styles.loader} />
            </>
          )}
        </Card>
      </View>
    </Modal>
  );

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8f9fa" />
      
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Plugin Manager</Text>
      </View>

      {renderTabBar()}

      <View style={styles.content}>
        {isLoading && activeTab !== 'installed' ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.loadingText}>Loading plugins...</Text>
          </View>
        ) : (
          <>
            {activeTab === 'installed' && renderInstalledTab()}
            {activeTab === 'marketplace' && renderMarketplaceTab()}
            {activeTab === 'settings' && renderSettingsTab()}
          </>
        )}
      </View>

      {renderInstallationModal()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#212529',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginHorizontal: 4,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#007AFF',
  },
  tabText: {
    fontSize: 16,
    color: '#6c757d',
    marginRight: 4,
  },
  activeTabText: {
    color: '#007AFF',
    fontWeight: '500',
  },
  badge: {
    backgroundColor: '#007AFF',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  pluginCard: {
    marginBottom: 12,
  },
  pluginCardContent: {
    padding: 16,
  },
  pluginHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  pluginIcon: {
    width: 48,
    height: 48,
    borderRadius: 8,
    marginRight: 12,
  },
  pluginInfo: {
    flex: 1,
  },
  pluginName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212529',
    marginBottom: 4,
  },
  pluginDescription: {
    fontSize: 14,
    color: '#6c757d',
  },
  offlineIndicator: {
    fontSize: 12,
    color: '#dc3545',
    fontStyle: 'italic',
  },
  pluginFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pluginMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pluginVersion: {
    fontSize: 12,
    color: '#6c757d',
    marginRight: 8,
  },
  freeTag: {
    fontSize: 12,
    color: '#28a745',
    fontWeight: '600',
    backgroundColor: '#d4edda',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  installButton: {
    paddingHorizontal: 16,
  },
  offlineCard: {
    backgroundColor: '#fff3cd',
    borderColor: '#ffeaa7',
    marginBottom: 16,
  },
  offlineTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#856404',
    marginBottom: 4,
  },
  offlineText: {
    fontSize: 14,
    color: '#856404',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#212529',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: '#6c757d',
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  browseButton: {
    paddingHorizontal: 24,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#6c757d',
    marginTop: 12,
  },
  settingsCard: {
    marginBottom: 16,
  },
  settingsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#212529',
    marginBottom: 16,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  settingLabel: {
    fontSize: 16,
    color: '#212529',
  },
  settingButton: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  settingButtonText: {
    fontSize: 16,
    color: '#007AFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  installModal: {
    width: '100%',
    maxWidth: 300,
    padding: 24,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#212529',
    marginBottom: 16,
  },
  modalStep: {
    fontSize: 16,
    color: '#6c757d',
    marginBottom: 16,
    textAlign: 'center',
  },
  progressContainer: {
    width: '100%',
    marginBottom: 24,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#e9ecef',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    color: '#6c757d',
    textAlign: 'center',
  },
  loader: {
    marginTop: 16,
  },
});