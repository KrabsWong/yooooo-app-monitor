import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTheme } from "@/components/theme-provider";
import type { Theme } from "@/components/theme-provider";

const themeOptions: Array<{ value: Theme; label: string; icon: LucideIcon }> = [
  { value: "light", label: "Light", icon: SunIcon },
  { value: "dark", label: "Dark", icon: MoonIcon },
  { value: "system", label: "System", icon: MonitorIcon }
];

export function ThemeToggle() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const selectedTheme = themeOptions.find((option) => option.value === theme) ?? themeOptions[2];
  const label = theme === "system" ? `${selectedTheme.label} (${resolvedTheme})` : selectedTheme.label;

  return (
    <Select value={theme} onValueChange={(value) => setTheme(value as Theme)}>
      <SelectTrigger aria-label={`Theme: ${label}`} className="h-9 w-[132px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end" position="popper">
        <SelectGroup>
          {themeOptions.map((option) => {
            const Icon = option.icon;

            return (
              <SelectItem key={option.value} value={option.value}>
                <span className="flex items-center gap-2">
                  <Icon data-icon="inline-start" />
                  <span>{option.label}</span>
                </span>
              </SelectItem>
            );
          })}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
