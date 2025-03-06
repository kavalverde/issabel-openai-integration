export default () => ({
    port: parseInt(process.env.PORT, 10) || 3000,
    issabel: {
      ariUrl: process.env.ISSABEL_ARI_URL,
      username: process.env.ISSABEL_ARI_USERNAME,
      password: process.env.ISSABEL_ARI_PASSWORD,
      appName: process.env.ISSABEL_STASIS_APP,
    },
    openai: {
      apiKey: process.env.OPENAI_API_KEY,
    },
  });