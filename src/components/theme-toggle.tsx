import { MoonIcon, SunIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useTheme } from "@/components/theme-provider";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const nextTheme = theme === "dark" ? "light" : "dark";
  const label = `Switch to ${nextTheme} mode`;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button aria-label={label} onClick={() => setTheme(nextTheme)} size="icon-sm" variant="outline">
          {theme === "dark" ? <SunIcon data-icon="inline-start" /> : <MoonIcon data-icon="inline-start" />}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
