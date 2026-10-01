# Theme values

The timer uses the neutral shadcn New York theme already defined in `src/styles/global.css`. Values below are the source values in OKLCH; Tailwind's semantic utilities resolve through the matching custom properties rather than defining a second palette.

| Role                 | Light (`:root`)             | Dark (`.dark`)                              | Source                       |
| -------------------- | --------------------------- | ------------------------------------------- | ---------------------------- |
| `background`         | `oklch(1 0 0)`              | `oklch(0.145 0 0)`                          | Existing neutral shadcn base |
| `foreground`         | `oklch(0.145 0 0)`          | `oklch(0.985 0 0)`                          | Existing neutral shadcn base |
| `card`               | `oklch(1 0 0)`              | `oklch(0.205 0 0)`                          | Existing neutral shadcn base |
| `card-foreground`    | `oklch(0.145 0 0)`          | `oklch(0.985 0 0)`                          | Existing neutral shadcn base |
| `primary`            | `oklch(0.205 0 0)`          | `oklch(0.922 0 0)`                          | Existing neutral shadcn base |
| `primary-foreground` | `oklch(0.985 0 0)`          | `oklch(0.205 0 0)`                          | Existing neutral shadcn base |
| `muted`              | `oklch(0.97 0 0)`           | `oklch(0.269 0 0)`                          | Existing neutral shadcn base |
| `muted-foreground`   | `oklch(0.556 0 0)`          | `oklch(0.708 0 0)`                          | Existing neutral shadcn base |
| `border` / `input`   | `oklch(0.922 0 0)`          | `oklch(1 0 0 / 10%)` / `oklch(1 0 0 / 15%)` | Existing neutral shadcn base |
| `ring`               | `oklch(0.708 0 0)`          | `oklch(0.556 0 0)`                          | Existing neutral shadcn base |
| `destructive`        | `oklch(0.577 0.245 27.325)` | `oklch(0.704 0.191 22.216)`                 | Existing shadcn error role   |

No token values were changed in this phase. The base already supplies each role required by the timer; visible application of these roles is made in the timer view. Pause and audio notices should use neutral `muted` surfaces with `foreground`/`muted-foreground`, not phase colors. The `@theme inline` block maps each published role to its corresponding custom property.

The phase 2 contrast check required bringing forward the form's hint and error text utilities: `text-muted-foreground` and `text-destructive`. The remaining form controls and run presentation belong to phase 3.
