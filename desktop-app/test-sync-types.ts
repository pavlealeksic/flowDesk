// Test sync transport types
import { BaseSyncTransport } from '../shared/src/types/config';
import { CloudStorageTransport } from './src/main/transports/CloudStorageTransport';
import { LANSyncTransport } from './src/main/transports/LANSyncTransport';
import { ImportExportTransport } from './src/main/transports/ImportExportTransport';

// Test that all transport implementations properly implement BaseSyncTransport
function testTransportTypes() {
  // This should compile without errors if types are correct
  const cloudTransport: BaseSyncTransport = new CloudStorageTransport('icloud');
  const lanTransport: BaseSyncTransport = new LANSyncTransport();
  const importExportTransport: BaseSyncTransport = new ImportExportTransport();
  
  // Test that all required methods exist
  console.log(cloudTransport.name);
  console.log(cloudTransport.isAvailable());
  console.log(lanTransport.name);
  console.log(lanTransport.isAvailable());
  console.log(importExportTransport.name);
  console.log(importExportTransport.isAvailable());
}

testTransportTypes();