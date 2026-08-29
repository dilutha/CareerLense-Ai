import { describe, expect, it } from "vitest";
import { assertSafeExternalUrl, UnsafeUrlError } from "./url-safety";

describe("assertSafeExternalUrl", () => {
  it("allows a normal https URL", () => {
    expect(() => assertSafeExternalUrl("https://example.com/jobs/123")).not.toThrow();
  });

  it("rejects non-https schemes", () => {
    expect(() => assertSafeExternalUrl("http://example.com")).toThrow(UnsafeUrlError);
    expect(() => assertSafeExternalUrl("javascript:alert(1)")).toThrow(UnsafeUrlError);
    expect(() => assertSafeExternalUrl("data:text/html,hi")).toThrow(UnsafeUrlError);
    expect(() => assertSafeExternalUrl("file:///etc/passwd")).toThrow(UnsafeUrlError);
  });

  it("rejects localhost and loopback", () => {
    expect(() => assertSafeExternalUrl("https://localhost/admin")).toThrow(UnsafeUrlError);
    expect(() => assertSafeExternalUrl("https://127.0.0.1/admin")).toThrow(UnsafeUrlError);
  });

  it("rejects private IPv4 ranges, including the cloud metadata endpoint", () => {
    expect(() => assertSafeExternalUrl("https://10.0.0.5/")).toThrow(UnsafeUrlError);
    expect(() => assertSafeExternalUrl("https://192.168.1.1/")).toThrow(UnsafeUrlError);
    expect(() => assertSafeExternalUrl("https://172.16.0.1/")).toThrow(UnsafeUrlError);
    expect(() => assertSafeExternalUrl("https://169.254.169.254/latest/meta-data")).toThrow(UnsafeUrlError);
  });

  it("rejects a malformed URL", () => {
    expect(() => assertSafeExternalUrl("not a url")).toThrow(UnsafeUrlError);
  });

  it("does not falsely block a public IP that merely starts with a private-looking octet", () => {
    // 172.32.x.x is outside the 172.16.0.0/12 private range (16-31 only).
    expect(() => assertSafeExternalUrl("https://172.32.0.1/")).not.toThrow();
  });
});
