import { legalLinksFromEnvironment } from "./legal-config";

describe("legal link configuration", () => {
  it("accepts only public http or https URLs", () => {
    expect(legalLinksFromEnvironment({
      EXPO_PUBLIC_TERMS_URL: "https://form.example/terms",
      EXPO_PUBLIC_PRIVACY_URL: "https://form.example/privacy",
    })).toEqual({
      termsUrl: "https://form.example/terms",
      privacyUrl: "https://form.example/privacy",
    });
  });

  it("fails closed when either URL is missing or unsafe", () => {
    expect(() => legalLinksFromEnvironment({
      EXPO_PUBLIC_TERMS_URL: "",
      EXPO_PUBLIC_PRIVACY_URL: "https://form.example/privacy",
    })).toThrow("EXPO_PUBLIC_TERMS_URL");
    expect(() => legalLinksFromEnvironment({
      EXPO_PUBLIC_TERMS_URL: "javascript:alert(1)",
      EXPO_PUBLIC_PRIVACY_URL: "https://form.example/privacy",
    })).toThrow("EXPO_PUBLIC_TERMS_URL");
  });
});
