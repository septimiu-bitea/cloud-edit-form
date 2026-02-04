// Helper to load test config from parent sections folder
// This allows sharing the same test config between sections/ and vue-app/

export async function loadParentTestConfig() {
  // In Node.js, try to require the parent config
  if (typeof process !== 'undefined' && process.versions?.node) {
    try {
      const fs = await import('fs')
      const path = await import('path')
      const { fileURLToPath } = await import('url')
      const __filename = fileURLToPath(import.meta.url)
      const __dirname = path.dirname(__filename)
      
      const parentConfigPath = path.resolve(__dirname, '../../sections/test.config.js')
      if (fs.existsSync(parentConfigPath)) {
        // Use dynamic import for ES modules
        const config = await import(parentConfigPath)
        return config.default || config
      }
    } catch (e) {
      // Ignore errors - will fall back to defaults
    }
  }
  
  return null
}
