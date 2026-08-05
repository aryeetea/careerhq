/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    container: {
      center: true,
      padding: "1.5rem",
    },
    extend: {
      fontFamily: {
        sans: ["'Shantell Sans'", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
        display: ["'Caveat'", "'Shantell Sans'", "cursive"],
        mono: ["'JetBrains Mono'", "monospace"],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
        rose: {
          DEFAULT: "hsl(var(--rose))",
          foreground: "hsl(var(--rose-foreground))",
        },
        sage: {
          DEFAULT: "hsl(var(--sage))",
          foreground: "hsl(var(--sage-foreground))",
        },
        lavender: {
          DEFAULT: "hsl(var(--lavender))",
          foreground: "hsl(var(--lavender-foreground))",
        },
        gold: {
          DEFAULT: "hsl(var(--gold))",
          foreground: "hsl(var(--gold-foreground))",
        },
        peach: {
          DEFAULT: "hsl(var(--peach))",
          foreground: "hsl(var(--peach-foreground))",
        },
        sky: {
          DEFAULT: "hsl(var(--sky))",
          foreground: "hsl(var(--sky-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 4px)",
        sm: "calc(var(--radius) - 8px)",
        xl: "calc(var(--radius) + 6px)",
        "2xl": "calc(var(--radius) + 14px)",
      },
      boxShadow: {
        soft: "0 1px 2px hsl(var(--shadow-color) / 0.04), 0 4px 16px -4px hsl(var(--shadow-color) / 0.08)",
        lift: "0 2px 4px hsl(var(--shadow-color) / 0.06), 0 12px 28px -8px hsl(var(--shadow-color) / 0.16)",
        glass: "0 1px 1px hsl(var(--shadow-color) / 0.05), 0 8px 24px -8px hsl(var(--shadow-color) / 0.18), inset 0 1px 0 hsl(var(--glass-highlight) / 0.6)",
      },
      backgroundImage: {
        "warm-gradient": "linear-gradient(135deg, hsl(var(--peach) / 0.25), hsl(var(--rose) / 0.18) 45%, hsl(var(--lavender) / 0.2))",
      },
      keyframes: {
        "accordion-down": { from: { height: "0" }, to: { height: "var(--radix-accordion-content-height)" } },
        "accordion-up": { from: { height: "var(--radix-accordion-content-height)" }, to: { height: "0" } },
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "slide-up": { from: { opacity: "0", transform: "translateY(6px)" }, to: { opacity: "1", transform: "translateY(0)" } },
        "scale-in": { from: { opacity: "0", transform: "scale(0.97)" }, to: { opacity: "1", transform: "scale(1)" } },
        "drift-a": {
          "0%, 100%": { transform: "translate(0, 0) scale(1)" },
          "50%": { transform: "translate(3%, -4%) scale(1.05)" },
        },
        "drift-b": {
          "0%, 100%": { transform: "translate(0, 0) scale(1)" },
          "50%": { transform: "translate(-4%, 3%) scale(1.08)" },
        },
        "drift-c": {
          "0%, 100%": { transform: "translate(0, 0) scale(1)" },
          "50%": { transform: "translate(2%, 4%) scale(1.04)" },
        },
        stream: {
          "0%, 100%": { transform: "translate3d(-4%, 0, 0) rotate(-10deg) scaleX(1)" },
          "50%": { transform: "translate3d(4%, -2%, 0) rotate(-6deg) scaleX(1.08)" },
        },
        "stream-reverse": {
          "0%, 100%": { transform: "translate3d(4%, 2%, 0) rotate(8deg) scaleX(1)" },
          "50%": { transform: "translate3d(-5%, -1%, 0) rotate(12deg) scaleX(1.12)" },
        },
        "drift-soft": {
          "0%, 100%": { transform: "translate3d(0, 0, 0) scale(1)" },
          "50%": { transform: "translate3d(0, -6%, 0) scale(1.06)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "gentle-pop": {
          "0%": { transform: "scale(1)" },
          "40%": { transform: "scale(1.06)" },
          "100%": { transform: "scale(1)" },
        },
        "ring-glow": {
          "0%, 100%": { boxShadow: "0 0 0 0 hsl(var(--gold) / 0.35)" },
          "50%": { boxShadow: "0 0 0 6px hsl(var(--gold) / 0)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.18s ease-out",
        "slide-up": "slide-up 0.22s cubic-bezier(0.16, 1, 0.3, 1)",
        "scale-in": "scale-in 0.16s ease-out",
        "drift-a": "drift-a 22s ease-in-out infinite",
        "drift-b": "drift-b 26s ease-in-out infinite",
        "drift-c": "drift-c 30s ease-in-out infinite",
        stream: "stream 18s ease-in-out infinite",
        "stream-reverse": "stream-reverse 24s ease-in-out infinite",
        "drift-soft": "drift-soft 20s ease-in-out infinite",
        shimmer: "shimmer 2.4s linear infinite",
        "gentle-pop": "gentle-pop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)",
        "ring-glow": "ring-glow 2.2s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
