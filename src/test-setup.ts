// Without the real stylesheet every Tailwind class is inert in the browser
// tests. That is not just cosmetic: Ariakit's dialog backdrop positions itself
// with inline `position: fixed`, so an unstyled dialog renders *underneath* it
// and Playwright's actionability check never resolves — clicks retry forever.
import "@/styles/globals.css";
