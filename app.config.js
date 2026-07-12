const appJson = require("./app.json");

const googleMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY;

module.exports = () => {
  const expo = appJson.expo ?? appJson;

  return {
    ...appJson,
    expo: {
      ...expo,
      android: {
        ...expo.android,
        config: {
          ...(expo.android?.config ?? {}),
          googleMaps: {
            apiKey: googleMapsApiKey,
          },
        },
      },
      ios: {
        ...expo.ios,
        config: {
          ...(expo.ios?.config ?? {}),
          googleMapsApiKey,
        },
      },
    },
  };
};
