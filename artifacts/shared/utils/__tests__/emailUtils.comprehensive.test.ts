import { normalizeEmail } from "../emailUtils";

describe("normalizeEmail - Comprehensive Test Suite", () => {
  describe("Happy Path Tests", () => {
    it("tc-001: should normalize mixed-case email to lowercase", () => {
      expect(normalizeEmail('User@Example.COM')).toBe('user@example.com');
    });

    it("tc-002: should trim leading and trailing whitespace", () => {
      expect(normalizeEmail('  admin@test.com  ')).toBe('admin@test.com');
    });

    it("tc-005: should normalize all uppercase email address", () => {
      expect(normalizeEmail('ADMIN@COMPANY.COM')).toBe('admin@company.com');
    });

    it("tc-007: should preserve already normalized email", () => {
      expect(normalizeEmail('user@domain.com')).toBe('user@domain.com');
    });

    it("tc-009: should verify function is exported and callable", () => {
      expect(typeof normalizeEmail).toBe('function');
    });
  });

  describe("Edge Case Tests", () => {
    it("tc-003: should handle empty string input", () => {
      expect(normalizeEmail('')).toBe('');
    });

    it("tc-004: should normalize email with tabs and newlines", () => {
      expect(normalizeEmail('\ttest@example.com\n')).toBe('test@example.com');
    });

    it("tc-006: should handle whitespace-only string", () => {
      expect(normalizeEmail('   ')).toBe('');
    });

    it("tc-008: should normalize email with mixed whitespace types", () => {
      expect(normalizeEmail(' \t Test@Example.Com \n ')).toBe('test@example.com');
    });

    it("tc-010: should handle single character email", () => {
      expect(normalizeEmail('A')).toBe('a');
    });

    it("tc-011: should handle email with special characters", () => {
      expect(normalizeEmail('User+Tag@Example.COM')).toBe('user+tag@example.com');
    });

    it("tc-012: should handle email with internal whitespace", () => {
      expect(normalizeEmail('user @example.com')).toBe('user @example.com');
    });
  });

  describe("Boundary Tests", () => {
    it("should handle carriage return characters", () => {
      expect(normalizeEmail('\rtest@example.com\r')).toBe('test@example.com');
    });

    it("should handle very long email addresses", () => {
      const longEmail = 'A'.repeat(100) + '@' + 'B'.repeat(100) + '.COM';
      const expected = 'a'.repeat(100) + '@' + 'b'.repeat(100) + '.com';
      expect(normalizeEmail(longEmail)).toBe(expected);
    });

    it("should handle email with unicode characters", () => {
      expect(normalizeEmail('  Tëst@Example.COM  ')).toBe('tëst@example.com');
    });
  });

  describe("Combination Tests", () => {
    it("should handle mixed case with leading/trailing whitespace simultaneously", () => {
      expect(normalizeEmail('  Admin@COMPANY.com  ')).toBe('admin@company.com');
    });

    it("should handle all edge cases together", () => {
      expect(normalizeEmail('\t  USER+TAG@EXAMPLE.COM  \n')).toBe('user+tag@example.com');
    });
  });
});