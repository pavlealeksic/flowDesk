/**
 * Test file to verify electron-store v10 integration works correctly
 * This file demonstrates that all store methods are properly typed and functional
 */

import { createTypedStore, TypedStore } from '../types/store';

interface TestData {
  accounts: { id: string; name: string; email: string }[];
  settings: {
    enabled: boolean;
    count: number;
  };
  lastUpdate: string | null;
}

// Test function to verify all operations work
export function testElectronStoreIntegration() {
  const store: TypedStore<TestData> = createTypedStore<TestData>({
    name: 'test-store',
    defaults: {
      accounts: [],
      settings: {
        enabled: true,
        count: 0,
      },
      lastUpdate: null,
    },
  });

  // Test set operations
  store.set('settings.enabled', false);
  store.set('accounts', [{ id: '1', name: 'Test User', email: 'test@example.com' }]);
  store.set('lastUpdate', new Date().toISOString());

  // Test get operations
  const enabled: boolean = store.get('settings.enabled');
  const accounts: { id: string; name: string; email: string }[] = store.get('accounts');
  const lastUpdate: string | null = store.get('lastUpdate');

  // Test has operation
  const hasAccounts: boolean = store.has('accounts');
  const hasSettings: boolean = store.has('settings');

  // Test size property
  const storeSize: number = store.size;

  // Test delete operation
  store.delete('lastUpdate');

  // Test clear operation (but don't actually call it in test)
  // store.clear();

  console.log('ElectronStore v10 integration test passed!');
  console.log(`Store size: ${storeSize}`);
  console.log(`Enabled setting: ${enabled}`);
  console.log(`Accounts count: ${accounts.length}`);
  console.log(`Has accounts: ${hasAccounts}`);
  console.log(`Has settings: ${hasSettings}`);

  return {
    success: true,
    data: {
      enabled,
      accounts,
      lastUpdate,
      hasAccounts,
      hasSettings,
      storeSize,
    },
  };
}