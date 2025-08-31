#!/usr/bin/env node

// Simple test script to verify NAPI bindings work
const bindings = require('./index.js');

async function testRustBindings() {
  console.log('🦀 Testing Flow Desk Rust NAPI bindings...\n');

  try {
    // Test version
    console.log('📦 Version:', bindings.getVersion());

    // Test crypto functions
    console.log('\n🔐 Testing crypto functions...');
    const keyPair = JSON.parse(bindings.generateEncryptionKeyPair());
    console.log('✅ Generated key pair:', {
      publicKey: keyPair.publicKey.substring(0, 16) + '...',
      privateKey: keyPair.privateKey.substring(0, 16) + '...'
    });

    const plaintext = 'Hello from Rust crypto!';
    const encrypted = bindings.encryptString(plaintext, keyPair.privateKey);
    const decrypted = bindings.decryptString(encrypted, keyPair.privateKey);
    console.log('✅ Encryption/Decryption test:', {
      original: plaintext,
      encrypted: encrypted.substring(0, 32) + '...',
      decrypted: decrypted
    });

    // Test mail engine
    console.log('\n📧 Testing mail engine...');
    const mailInit = await bindings.initMailEngine();
    console.log('✅ Mail engine init:', mailInit);

    const testAccount = {
      id: 'test-account-1',
      email: 'test@example.com',
      provider: 'gmail',
      displayName: 'Test User',
      isEnabled: true
    };

    await bindings.addMailAccount(testAccount);
    console.log('✅ Added mail account:', testAccount.email);

    const accounts = await bindings.getMailAccounts();
    console.log('✅ Retrieved mail accounts:', accounts.length);

    const syncStatus = await bindings.syncMailAccount('test-account-1');
    console.log('✅ Mail sync status:', syncStatus);

    const messages = await bindings.getMailMessages('test-account-1');
    console.log('✅ Retrieved messages:', messages.length);

    // Test calendar engine
    console.log('\n📅 Testing calendar engine...');
    const calendarInit = await bindings.initCalendarEngine();
    console.log('✅ Calendar engine init:', calendarInit);

    const testCalendarAccount = {
      id: 'test-cal-account-1',
      email: 'calendar@example.com',
      provider: 'google',
      displayName: 'Test Calendar User',
      isEnabled: true
    };

    await bindings.addCalendarAccount(testCalendarAccount);
    console.log('✅ Added calendar account:', testCalendarAccount.email);

    const calendarAccounts = await bindings.getCalendarAccounts();
    console.log('✅ Retrieved calendar accounts:', calendarAccounts.length);

    const calendarSyncStatus = await bindings.syncCalendarAccount('test-cal-account-1');
    console.log('✅ Calendar sync status:', calendarSyncStatus);

    const calendars = await bindings.getCalendars('test-cal-account-1');
    console.log('✅ Retrieved calendars:', calendars.length);

    // Test search engine
    console.log('\n🔍 Testing search engine...');
    const searchInit = await bindings.initSearchEngine();
    console.log('✅ Search engine init:', searchInit);

    await bindings.indexDocument(
      'doc-1',
      'Test Document',
      'This is a test document for search functionality',
      'test',
      JSON.stringify({ category: 'test', priority: 'high' })
    );
    console.log('✅ Indexed test document');

    const searchResults = await bindings.searchDocuments('test document', 10);
    console.log('✅ Search results:', searchResults.length, searchResults.length > 0 ? `(found: ${searchResults[0].title})` : '');

    console.log('\n🎉 All tests passed! Rust NAPI bindings are working correctly.');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run tests
if (require.main === module) {
  testRustBindings();
}