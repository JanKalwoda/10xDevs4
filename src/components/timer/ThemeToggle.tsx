import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTimerTheme } from "@/components/hooks/useTimerTheme";

export default function ThemeToggle() {
    const { theme, toggleTheme } = useTimerTheme();
    const nextTheme = theme === "dark" ? "light" : "dark";

    return (
        <Button type="button" variant="outline" size="icon" aria-label={theme ? `Switch to ${nextTheme} mode (currently ${theme})` : "Change color theme"} onClick={toggleTheme}>
            {/* Both icons, picked by the .dark class that ThemeInit sets before paint, so the first paint is right without JS. */}
            <Moon aria-hidden="true" className="dark:hidden" />
            <Sun aria-hidden="true" className="hidden dark:block" />
        </Button>
    );
}
