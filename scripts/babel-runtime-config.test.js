const babel = require("@babel/core");

describe("Expo SDK 57 Babel runtime configuration", () => {
  test("lets babel-preset-expo configure Reanimated worklets", () => {
    const configureBabel = require("../babel.config");
    const config = configureBabel({ cache: jest.fn() });

    expect(config.presets).toEqual(["babel-preset-expo"]);
    expect(config.plugins ?? []).not.toContain("react-native-reanimated/plugin");

    const transformed = babel.transformSync(
      "function frame() { 'worklet'; return 1; }",
      {
        filename: __filename,
        configFile: require.resolve("../babel.config"),
      },
    );

    expect(transformed?.code).toContain("__workletHash");
  });
});
