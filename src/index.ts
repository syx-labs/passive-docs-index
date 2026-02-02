/**
 * Passive Docs Index
 * Library exports for programmatic usage
 */

// Types
export type {
  PDIConfig,
  ProjectConfig,
  SyncConfig,
  FrameworkConfig,
  InternalConfig,
  MCPConfig,
  LimitsConfig,
  FrameworkTemplate,
  DocFileTemplate,
  CriticalPattern,
  IndexSection,
  IndexEntry,
  IndexCategory,
  KnownFramework,
  DetectedDependency,
  InitOptions,
  AddOptions,
  SyncOptions,
  StatusResult,
  DocFile,
  DocsStructure,
} from './lib/types.js';

// Config
export {
  readConfig,
  writeConfig,
  configExists,
  createDefaultConfig,
  readPackageJson,
  detectProjectType,
  detectDependencies,
  getMajorVersion,
  cleanVersion,
  updateFrameworkInConfig,
  removeFrameworkFromConfig,
  updateSyncTime,
} from './lib/config.js';

// Index Parser
export {
  parseIndex,
  generateIndex,
  generateIndexBlock,
  readClaudeMd,
  extractIndexFromClaudeMd,
  updateClaudeMdIndex,
  buildIndexSections,
  calculateIndexSize,
} from './lib/index-parser.js';

// Templates
export {
  getTemplate,
  hasTemplate,
  listTemplates,
  getTemplatesByCategory,
  getTemplatesByPriority,
  FRAMEWORK_TEMPLATES,
} from './lib/templates.js';

// Context7
export {
  generateResolveLibraryCall,
  generateQueryDocsCall,
  generateTemplateQueries,
  processContext7Response,
  extractRelevantSections,
  generateMcpFallbackInstructions,
  generateBatchQueries,
} from './lib/context7.js';

// File System Utils
export {
  ensureDir,
  removeDir,
  listDir,
  listDirRecursive,
  writeDocFile,
  writeInternalDocFile,
  readDocFile,
  readFrameworkDocs,
  readAllFrameworkDocs,
  readInternalDocs,
  calculateDocsSize,
  formatSize,
  updateGitignore,
} from './lib/fs-utils.js';

// Constants
export {
  CLAUDE_DOCS_DIR,
  CONFIG_FILE,
  FRAMEWORKS_DIR,
  INTERNAL_DIR,
  CLAUDE_MD_FILE,
  PDI_BEGIN_MARKER,
  PDI_END_MARKER,
  DEFAULT_CONFIG,
  KNOWN_FRAMEWORKS,
  PROJECT_TYPE_INDICATORS,
} from './lib/constants.js';
