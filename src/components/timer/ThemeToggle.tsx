import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTimerTheme } from "@/components/hooks/useTimerTheme";

export default function ThemeToggle() {
    const { theme, toggleTheme } = useTimerTheme();
    const nextTheme = theme === "dark" ? "light" : "dark";

    return (
        <Button type="button" variant="outline" size="icon" aria-label={theme ? `Switch to ${nextTheme} mode (currently ${theme})` : "Change color theme"} onClick={toggleTheme}>
            {nextTheme === "dark" ? <Moon aria-hidden="true" /> : <Sun aria-hidden="true" />}
        </Button>
    );
}
