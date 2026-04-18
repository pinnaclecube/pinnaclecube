import * as React from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export interface ComboboxOption {
  value: string;
  label: string;
}

interface SearchableComboboxProps {
  options: ComboboxOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  /** Allow the user to enter a free-text value not in the list */
  allowCustom?: boolean;
  className?: string;
  disabled?: boolean;
}

export function SearchableCombobox({
  options,
  value,
  onChange,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  emptyMessage = "No results found.",
  allowCustom = false,
  className,
  disabled = false,
}: SearchableComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");

  const selectedLabel = React.useMemo(
    () => options.find((o) => o.value === value)?.label ?? value,
    [options, value],
  );

  // Show a "Use: <query>" option when allowCustom and the query doesn't match any option exactly
  const showCustomOption =
    allowCustom &&
    query.trim().length > 0 &&
    !options.some((o) => o.label.toLowerCase() === query.trim().toLowerCase());

  const handleSelect = (selectedValue: string) => {
    onChange(selectedValue === value ? "" : selectedValue);
    setQuery("");
    setOpen(false);
  };

  const handleCustomSelect = () => {
    const trimmed = query.trim();
    if (trimmed) {
      onChange(trimmed);
      setQuery("");
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full justify-between font-normal text-left h-9 px-3",
            !value && "text-muted-foreground",
            className,
          )}
        >
          <span className="truncate">{value ? selectedLabel : placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="p-0"
        style={{ width: "var(--radix-popover-trigger-width)" }}
        align="start"
        side="bottom"
        sideOffset={4}
      >
        <Command shouldFilter={true}>
          <CommandInput
            placeholder={searchPlaceholder}
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            <CommandEmpty>
              {showCustomOption ? null : emptyMessage}
            </CommandEmpty>

            {showCustomOption && (
              <CommandGroup>
                <CommandItem
                  value={`__custom__${query}`}
                  onSelect={handleCustomSelect}
                  className="text-[#1E2D6B] font-medium"
                >
                  <Plus className="mr-2 h-4 w-4 shrink-0" />
                  Use &ldquo;{query.trim()}&rdquo;
                </CommandItem>
              </CommandGroup>
            )}

            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.label}
                  onSelect={() => handleSelect(option.value)}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4 shrink-0",
                      value === option.value ? "opacity-100" : "opacity-0",
                    )}
                  />
                  {option.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
