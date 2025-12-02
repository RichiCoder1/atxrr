import defaultTheme from "tailwindcss/defaultTheme";
import plugin from "tailwindcss/plugin";

/** TODO: Migrate this to the v4 Tailwind Format */

/** @type {import('tailwindcss').Config} */
export default {
	darkMode: ["class"],
	content: ["./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}"],
	theme: {
		container: {
			center: true,
			padding: "2rem",
			screens: {
				"2xl": "1400px",
			},
		},
		data: {
			enter: "enter",
			exit: "exit",
		},
		extend: {
			fontFamily: {
				sans: ['"Open Sans Variable"', ...defaultTheme.fontFamily.sans],
			},
			colors: {
				border: "var(--border)",
				input: "var(--input)",
				ring: "var(--ring)",
				background: "var(--background)",
				foreground: "var(--foreground)",
				primary: {
					DEFAULT: "var(--primary)",
					foreground: "var(--primary-foreground)",
				},
				secondary: {
					DEFAULT: "var(--secondary)",
					foreground: "var(--secondary-foreground)",
				},
				alternate: {
					DEFAULT: "var(--alternate)",
					foreground: "var(--alternate-foreground)",
				},
				destructive: {
					DEFAULT: "var(--destructive)",
					foreground: "var(--destructive-foreground)",
				},
				muted: {
					DEFAULT: "var(--muted)",
					foreground: "var(--muted-foreground)",
				},
				accent: {
					DEFAULT: "var(--accent)",
					foreground: "var(--accent-foreground)",
				},
				popover: {
					DEFAULT: "var(--popover)",
					foreground: "var(--popover-foreground)",
				},
				card: {
					DEFAULT: "var(--card)",
					foreground: "var(--card-foreground)",
				},
			},
			borderRadius: {
				lg: "var(--radius)",
				md: "calc(var(--radius) - 2px)",
				sm: "calc(var(--radius) - 4px)",
			},
			keyframes: {
				"accordion-down": {
					from: { height: 0 },
					to: { height: "var(--radix-accordion-content-height)" },
				},
				"accordion-up": {
					from: { height: "var(--radix-accordion-content-height)" },
					to: { height: 0 },
				},
			},
			animation: {
				"accordion-down": "accordion-down 0.2s ease-out",
				"accordion-up": "accordion-up 0.2s ease-out",
			},
		},
	},
	plugins: [
		plugin(({ addVariant, matchUtilities, theme }) => {
			matchUtilities(
				{
					"text-stroke": (value) => ({
						textStroke: value,
						"--webkit-text-stroke": value,
					}),
				},
				{ values: theme("outlineWidth") },
			);

			addVariant("disabled", ["&:disabled", "&[aria-disabled=true]"]);
			addVariant("focus-visible", ["&:focus-visible", "&[data-focus-visible]"]);
			addVariant("current", [
				"&[aria-current]:not([aria-current=''], [aria-current='false'])",
			]);
		}),
	],
};
