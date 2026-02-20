module.exports = function (api) {
  const isWeb = process.env.EXPO_OS === "web";
  api.cache(true);

  return {
    presets: [
      [
        "babel-preset-expo",
        {
          jsxImportSource: "nativewind",
          lazyImports: true,
        },
      ],
      "nativewind/babel",
    ],
    plugins: [
      !isWeb && "react-native-reanimated/plugin",
    ].filter(Boolean),
  };
};
