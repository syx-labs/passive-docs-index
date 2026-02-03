/**
 * Passive Docs Index
 * Library exports for programmatic usage
 */

// Commands (for programmatic use)
export {
  addCommand,
  authCommand,
  cleanCommand,
  doctorCommand,
  generateCommand,
  initCommand,
  loadApiKeyFromConfig,
  statusCommand,
  syncCommand,
  updateCommand,
} from "./commands/index.js";

// Config
export {
  cleanVersion,
  configExists,
  createDefaultConfig,
  detectDependencies,
  detectProjectType,
  getMajorVersion,
  readConfig,
  readPackageJson,
  removeFrameworkFromConfig,
  updateFrameworkInConfig,
  updateSyncTime,
  writeConfig,
} from "./lib/config.js";
// Constants
export {
  CLAUDE_DOCS_DIR,
  CLAUDE_MD_FILE,
  CONFIG_FILE,
  DEFAULT_CONFIG,
  FRAMEWORKS_DIR,
  INTERNAL_DIR,
  KNOWN_FRAMEWORKS,
  PDI_BEGIN_MARKER,
  PDI_END_MARKER,
  PROJECT_TYPE_INDICATORS,
} from "./lib/constants.js";
// Context7
export {
  extractRelevantSections,
  generateBatchQueries,
  generateMcpFallbackInstructions,
  generateQueryDocsCall,
  generateResolveLibraryCall,
  generateTemplateQueries,
  processContext7Response,
} from "./lib/context7.js";
// Context7 Unified Client (recommended)
export {
  type AvailabilityStatus,
  type Context7ClientConfig,
  type Context7Result,
  checkAvailability,
  isHttpClientAvailable,
  queryContext7,
  resetClients,
  searchLibrary,
} from "./lib/context7-client.js";
// File System Utils
export {
  calculateDocsSize,
  ensureDir,
  formatSize,
  listDir,
  listDirRecursive,
  readAllFrameworkDocs,
  readDocFile,
  readFrameworkDocs,
  readInternalDocs,
  removeDir,
  updateGitignore,
  writeDocFile,
  writeInternalDocFile,
} from "./lib/fs-utils.js";
// Index Parser
export {
  buildIndexSections,
  calculateIndexSize,
  extractIndexFromClaudeMd,
  generateIndex,
  generateIndexBlock,
  parseIndex,
  readClaudeMd,
  updateClaudeMdIndex,
} from "./lib/index-parser.js";
// MCP Client (low-level)
export {
  type BatchQueryItem,
  type BatchQueryResult,
  extractContext7Content,
  isMcpCliAvailable,
  type MCPResult,
  queryContext7 as queryContext7Mcp,
  queryContext7Batch,
  resetMcpCliCache,
  resolveContext7Library,
} from "./lib/mcp-client.js";
// Templates
export {
  FRAMEWORK_TEMPLATES,
  getTemplate,
  getTemplatesByCategory,
  getTemplatesByPriority,
  hasTemplate,
  listTemplates,
} from "./lib/templates.js";
// Types
export type {
  AddOptions,
  CriticalPattern,
  DetectedDependency,
  DocFile,
  DocFileTemplate,
  DocsStructure,
  FrameworkConfig,
  FrameworkTemplate,
  IndexCategory,
  IndexEntry,
  IndexSection,
  InitOptions,
  InternalConfig,
  KnownFramework,
  LimitsConfig,
  MCPConfig,
  PDIConfig,
  ProjectConfig,
  StatusResult,
  SyncConfig,
  SyncOptions,
} from "./lib/types.js";
