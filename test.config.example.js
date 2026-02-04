// ============================================================================
// TEST CONFIGURATION EXAMPLE
// ============================================================================
// Copy this file to test.config.js and fill in your values
// ⚠️ SECURITY WARNING: Never commit test.config.js with real credentials to version control!

export const TEST_CONFIG = {
  // Base URL of the d.velop instance
  baseUrl: 'https://your-instance.d-velop.cloud',
  
  // API key for authentication (optional in browser - cookies will be used)
  apiKey: null, // Set via environment variable TEST_API_KEY or here
  
  // Repository ID
  repoId: 'your-repo-id-here',
  
  // Document ID to test with
  documentId: 'MW00000001',
  
  // Category ID (optional - will be auto-detected from document if not set)
  categoryId: null,
  
  // On-premise mode: set to true to test on-premise API behavior (uses storedoctype)
  // Set to false to test cloud API behavior (uses objectmanagement endpoints)
  // Set to null/undefined to test both (default)
  onPremise: null,
  
  // Set to true to skip actual API calls (for development)
  skipApiCalls: false
};
