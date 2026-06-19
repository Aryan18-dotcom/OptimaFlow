const config = {
  plugins: {
    "@tailwindcss/postcss": {},
    "postcss-preset-env": {
      stage: 3,
      features: {
        "lab-function": true, // Explicitly enables support for lab() colors
      },
    },
    autoprefixer: {},
  },
};

export default config;