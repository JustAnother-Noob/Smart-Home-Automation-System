module.exports = {
    content: [
      "./index.html",
      "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
      extend: {
        colors: {
          primary: "#1376f4",
          white: "#ffffff",
          black: "#000000",
        },
        container: {
            center: true,
            padding: {
                DEFAULT: '1rem',
                sm: '3rem',
            }
        }
      },
    },
    plugins: [],
  };
  