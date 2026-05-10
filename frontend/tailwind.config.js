export default {
    content: ["./index.html", "./src/**/*.{js,jsx}"],
    theme: {
        extend: {
            colors: {
                ink: "#101828",
                panel: "#162033",
                line: "#26334f",
                glow: "#f59e0b",
                mint: "#34d399",
                rose: "#fb7185"
            },
            fontFamily: {
                display: ["Georgia", "serif"],
                body: ["ui-sans-serif", "system-ui", "sans-serif"]
            },
            boxShadow: {
                panel: "0 22px 60px rgba(15, 23, 42, 0.28)"
            }
        }
    },
    plugins: []
};
