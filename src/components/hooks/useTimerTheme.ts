import { useCallback, useEffect, useRef, useState } from "react";

export type TimerTheme = "light" | "dark";

const STORAGE_KEY = "drill-timer-theme";

function readStoredTheme(): TimerTheme | null {
    try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        return stored === "light" || stored === "dark" ? stored : null;
    } catch {
        return null;
    }
}

export function useTimerTheme() {
    const [theme, setTheme] = useState<TimerTheme | null>(null);
    const hasManualChoice = useRef(false);

    useEffect(() => {
        const storedTheme = readStoredTheme();
        const media = window.matchMedia("(prefers-color-scheme: dark)");
        const initialTheme = storedTheme ?? (media.matches ? "dark" : "light");

        queueMicrotask(() => {
            setTheme(initialTheme);
        });
        document.documentElement.classList.toggle("dark", initialTheme === "dark");

        if (storedTheme) return;

        const handleSystemThemeChange = (event: MediaQueryListEvent) => {
            if (hasManualChoice.current) return;
            const nextTheme = event.matches ? "dark" : "light";
            setTheme(nextTheme);
            document.documentElement.classList.toggle("dark", nextTheme === "dark");
        };

        media.addEventListener("change", handleSystemThemeChange);
        return () => {
            media.removeEventListener("change", handleSystemThemeChange);
        };
    }, []);

    const toggleTheme = useCallback(() => {
        const nextTheme = theme === "dark" ? "light" : "dark";
        hasManualChoice.current = true;
        setTheme(nextTheme);
        document.documentElement.classList.toggle("dark", nextTheme === "dark");

        try {
            window.localStorage.setItem(STORAGE_KEY, nextTheme);
        } catch {
            // Keep the in-memory choice even when storage is unavailable.
        }
    }, [theme]);

    return { theme, toggleTheme };
}
