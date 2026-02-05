/**
 * Unit tests for src/lib/templates.ts
 *
 * Tests all exported functions: getTemplate, hasTemplate, listTemplates,
 * getTemplatesByCategory, getTemplatesByPriority, plus validation of
 * the FRAMEWORK_TEMPLATES registry.
 */

import { describe, test, expect } from "bun:test";
import {
  getTemplate,
  hasTemplate,
  listTemplates,
  getTemplatesByCategory,
  getTemplatesByPriority,
  FRAMEWORK_TEMPLATES,
} from "../../../src/lib/templates.js";

// ============================================================================
// All 10 built-in template names
// ============================================================================

const ALL_TEMPLATE_NAMES = [
  "hono",
  "drizzle",
  "better-auth",
  "zod",
  "tanstack-query",
  "tanstack-router",
  "react",
  "vite",
  "vitest",
  "tailwind",
];

// ============================================================================
// getTemplate
// ============================================================================

describe("getTemplate", () => {
  test.each(ALL_TEMPLATE_NAMES)("returns template for '%s'", (name) => {
    const template = getTemplate(name);
    expect(template).toBeDefined();
    expect(template!.name).toBe(name);
  });

  test("returns undefined for unknown names", () => {
    expect(getTemplate("nonexistent")).toBeUndefined();
    expect(getTemplate("")).toBeUndefined();
    expect(getTemplate("angular")).toBeUndefined();
  });
});

// ============================================================================
// hasTemplate
// ============================================================================

describe("hasTemplate", () => {
  test.each(ALL_TEMPLATE_NAMES)("returns true for '%s'", (name) => {
    expect(hasTemplate(name)).toBe(true);
  });

  test("returns false for unknown names", () => {
    expect(hasTemplate("nonexistent")).toBe(false);
    expect(hasTemplate("")).toBe(false);
    expect(hasTemplate("angular")).toBe(false);
  });
});

// ============================================================================
// listTemplates
// ============================================================================

describe("listTemplates", () => {
  test("returns array with 10 templates", () => {
    const templates = listTemplates();
    expect(templates.length).toBe(10);
  });

  test("each template has required fields", () => {
    const templates = listTemplates();
    for (const t of templates) {
      expect(t.name).toBeDefined();
      expect(typeof t.name).toBe("string");
      expect(t.displayName).toBeDefined();
      expect(typeof t.displayName).toBe("string");
      expect(t.version).toBeDefined();
      expect(typeof t.version).toBe("string");
      expect(t.category).toBeDefined();
      expect(t.structure).toBeDefined();
      expect(typeof t.structure).toBe("object");
    }
  });

  test("all 10 template names are present", () => {
    const templates = listTemplates();
    const names = templates.map((t) => t.name);
    for (const name of ALL_TEMPLATE_NAMES) {
      expect(names).toContain(name);
    }
  });
});

// ============================================================================
// getTemplatesByCategory
// ============================================================================

describe("getTemplatesByCategory", () => {
  test('"backend" returns hono', () => {
    const templates = getTemplatesByCategory("backend");
    const names = templates.map((t) => t.name);
    expect(names).toContain("hono");
  });

  test('"frontend" returns react, tanstack-query, tanstack-router', () => {
    const templates = getTemplatesByCategory("frontend");
    const names = templates.map((t) => t.name);
    expect(names).toContain("react");
    expect(names).toContain("tanstack-query");
    expect(names).toContain("tanstack-router");
  });

  test('"database" returns drizzle', () => {
    const templates = getTemplatesByCategory("database");
    const names = templates.map((t) => t.name);
    expect(names).toContain("drizzle");
    expect(templates.length).toBe(1);
  });

  test('"auth" returns better-auth', () => {
    const templates = getTemplatesByCategory("auth");
    const names = templates.map((t) => t.name);
    expect(names).toContain("better-auth");
    expect(templates.length).toBe(1);
  });

  test('"validation" returns zod', () => {
    const templates = getTemplatesByCategory("validation");
    const names = templates.map((t) => t.name);
    expect(names).toContain("zod");
    expect(templates.length).toBe(1);
  });

  test('"build" returns vite', () => {
    const templates = getTemplatesByCategory("build");
    expect(templates.length).toBe(1);
    expect(templates[0].name).toBe("vite");
  });

  test('"testing" returns vitest', () => {
    const templates = getTemplatesByCategory("testing");
    expect(templates.length).toBe(1);
    expect(templates[0].name).toBe("vitest");
  });

  test('"styling" returns tailwind', () => {
    const templates = getTemplatesByCategory("styling");
    expect(templates.length).toBe(1);
    expect(templates[0].name).toBe("tailwind");
  });
});

// ============================================================================
// getTemplatesByPriority
// ============================================================================

describe("getTemplatesByPriority", () => {
  test('"P0" returns hono, drizzle, better-auth, zod', () => {
    const templates = getTemplatesByPriority("P0");
    const names = templates.map((t) => t.name);
    expect(names).toContain("hono");
    expect(names).toContain("drizzle");
    expect(names).toContain("better-auth");
    expect(names).toContain("zod");
    expect(templates.length).toBe(4);
  });

  test('"P1" returns the remaining 6', () => {
    const templates = getTemplatesByPriority("P1");
    const names = templates.map((t) => t.name);
    expect(names).toContain("tanstack-query");
    expect(names).toContain("tanstack-router");
    expect(names).toContain("react");
    expect(names).toContain("vite");
    expect(names).toContain("vitest");
    expect(names).toContain("tailwind");
    expect(templates.length).toBe(6);
  });

  test('"P2" returns empty array (no P2 templates)', () => {
    const templates = getTemplatesByPriority("P2");
    expect(templates.length).toBe(0);
  });
});

// ============================================================================
// FRAMEWORK_TEMPLATES registry validation
// ============================================================================

describe("FRAMEWORK_TEMPLATES", () => {
  test("every template has a non-empty structure with at least one category", () => {
    for (const [key, template] of Object.entries(FRAMEWORK_TEMPLATES)) {
      const categories = Object.keys(template.structure);
      expect(categories.length).toBeGreaterThan(0);
      // Each category should have at least one file entry
      for (const catName of categories) {
        const filesInCategory = Object.keys(template.structure[catName]);
        expect(filesInCategory.length).toBeGreaterThan(0);
      }
    }
  });

  test("every template has a libraryId", () => {
    for (const [key, template] of Object.entries(FRAMEWORK_TEMPLATES)) {
      expect(template.libraryId).toBeDefined();
      expect(typeof template.libraryId).toBe("string");
      expect(template.libraryId!.length).toBeGreaterThan(0);
    }
  });

  test("all template names match their key in the registry", () => {
    for (const [key, template] of Object.entries(FRAMEWORK_TEMPLATES)) {
      expect(template.name).toBe(key);
    }
  });

  test("every template has a description", () => {
    for (const [key, template] of Object.entries(FRAMEWORK_TEMPLATES)) {
      expect(template.description).toBeDefined();
      expect(template.description.length).toBeGreaterThan(0);
    }
  });

  test("every file entry in structure has query and topics", () => {
    for (const [key, template] of Object.entries(FRAMEWORK_TEMPLATES)) {
      for (const [catName, catFiles] of Object.entries(template.structure)) {
        for (const [fileName, fileTemplate] of Object.entries(catFiles)) {
          expect(fileTemplate.query).toBeDefined();
          expect(typeof fileTemplate.query).toBe("string");
          expect(fileTemplate.topics).toBeDefined();
          expect(Array.isArray(fileTemplate.topics)).toBe(true);
          expect(fileTemplate.topics.length).toBeGreaterThan(0);
        }
      }
    }
  });
});
