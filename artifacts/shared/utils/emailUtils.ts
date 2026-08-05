// === artifacts/shared/utils/emailUtils.ts ===
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

// === artifacts/shared/utils/__tests__/emailUtils.test.ts ===
import { normalizeEmail } from "../emailUtils";

describe("normalizeEmail", () => {
  it("should convert email to lowercase", () => {
    expect(normalizeEmail("Test@Example.COM")).toBe("test@example.com");
  });

  it("should trim whitespace around the email", () => {
    expect(normalizeEmail("  test@example.com  ")).toBe("test@example.com");
    expect(normalizeEmail("\ttest@example.com\n")).toBe("test@example.com");
  });

  it("should return an empty string if email is empty", () => {
    expect(normalizeEmail("")).toBe("");
  });
});

// === Using normalizeEmail in routes/email.ts ===
// Inside email route handlers, import and use normalizeEmail function
// Example:
// const normalizedEmail = normalizeEmail(to);