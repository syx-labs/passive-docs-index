/**
 * PDI Configuration Types
 * Defines the structure of config.json and related types
 */

// ============================================================================
// Config Types
// ============================================================================

export interface PDIConfig {
  $schema?: string;
  version: string;
  project: ProjectConfig;
  sync: SyncConfig;
  frameworks: Record<string, FrameworkConfig>;
  internal: InternalConfig;
  mcp: MCPConfig;
  limits: LimitsConfig;
}

export interface ProjectConfig {
  name: string;
  type: "backend" | "frontend" | "fullstack" | "library" | "cli";
}

export interface SyncConfig {
  lastSync: string | null;
  autoSyncOnInstall: boolean;
}

export interface FrameworkConfig {
  version: string;
  source: "context7" | "template" | "manual";
  libraryId?: string;
  lastUpdate: string;
  files: number;
  categories?: string[];
}

export interface InternalConfig {
  enabled: boolean;
  categories: string[];
  totalFiles: number;
}

export interface MCPConfig {
  fallbackEnabled: boolean;
  preferredProvider: "context7" | "firecrawl";
  providers?: {
    context7?: {
      resolveLibraryId: string;
      queryDocs: string;
    };
  };
  libraryMappings?: Record<string, string>;
  cacheHours: number;
}

export interface LimitsConfig {
  maxIndexKb: number;
  maxDocsKb: number;
  maxFilesPerFramework: number;
}

// ============================================================================
// Framework Template Types
// ============================================================================

export interface FrameworkTemplate {
  name: string;
  displayName: string;
  version: string;
  source: "context7" | "template";
  libraryId?: string;
  category:
    | "backend"
    | "frontend"
    | "validation"
    | "database"
    | "auth"
    | "styling"
    | "build"
    | "testing"
    | "ui";
  priority: "P0" | "P1" | "P2";
  description: string;
  structure: Record<string, Record<string, DocFileTemplate>>;
  criticalPatterns?: CriticalPattern[];
}

export interface DocFileTemplate {
  query: string;
  topics: string[];
}

export interface CriticalPattern {
  pattern: string;
  warning: string;
  correct: string;
}

// ============================================================================
// Index Types
// ============================================================================

export interface IndexSection {
  title: string;
  root: string;
  criticalInstructions: string[];
  entries: IndexEntry[];
}

export interface IndexEntry {
  package: string;
  version: string;
  categories: IndexCategory[];
}

export interface IndexCategory {
  name: string;
  files: string[];
}

// ============================================================================
// Detection Types
// ============================================================================

export interface KnownFramework {
  pattern: RegExp;
  name: string;
  displayName: string;
  libraryId?: string;
  category: FrameworkTemplate["category"];
}

export interface DetectedDependency {
  name: string;
  version: string;
  framework: KnownFramework | null;
  hasTemplate: boolean;
}

// ============================================================================
// CLI Types
// ============================================================================

export interface InitOptions {
  force?: boolean;
  noDetect?: boolean;
  internal?: boolean;
  projectRoot?: string;
}

export interface AddOptions {
  version?: string;
  minimal?: boolean;
  force?: boolean;
  noIndex?: boolean;
  projectRoot?: string;
}

export interface SyncOptions {
  yes?: boolean;
  check?: boolean;
  prune?: boolean;
  projectRoot?: string;
}

export interface StatusResult {
  project: ProjectConfig;
  frameworks: Array<{
    name: string;
    version: string;
    files: number;
    sizeKb: number;
    status: "up-to-date" | "update-available" | "outdated";
    installedVersion?: string;
  }>;
  internal: {
    categories: Array<{
      name: string;
      files: number;
      sizeKb: number;
    }>;
    totalFiles: number;
    totalSizeKb: number;
  };
  index: {
    sizeKb: number;
    limitKb: number;
    percentUsed: number;
  };
  lastSync: string | null;
}

// ============================================================================
// MCP Types
// ============================================================================

export interface Context7ResolveResult {
  libraryId: string;
  name: string;
  description?: string;
}

export interface Context7QueryResult {
  content: string;
  source?: string;
  topics?: string[];
}

// ============================================================================
// File System Types
// ============================================================================

export interface DocFile {
  path: string;
  framework: string;
  category: string;
  name: string;
  content: string;
  sizeBytes: number;
}

export interface DocsStructure {
  frameworks: Record<string, Record<string, DocFile[]>>;
  internal: Record<string, DocFile[]>;
}
