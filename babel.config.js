module.exports = function (api) {
  api.cache(true);

  const isWeb = api.caller((caller) => caller?.platform === "web");

  return {
    presets: [
      [
        "babel-preset-expo",
        {
          jsxImportSource: "nativewind",
          lazyImports: true,
          web: { unstable_transformProfile: "hermes-stable" },
        },
      ],
      "nativewind/babel",
    ],
    plugins: [
      !isWeb && "react-native-reanimated/plugin",
    ].filter(Boolean),
  };
};
