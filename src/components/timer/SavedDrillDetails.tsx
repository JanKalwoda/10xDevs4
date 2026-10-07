import DeleteDrillDialog from "@/components/timer/DeleteDrillDialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { describeDrillConfiguration } from "@/lib/saved-drill-summary";
import { cn } from "@/lib/utils";
import type { DrillConfiguration, SavedDrill } from "@/types";

interface SavedDrillDetailsProps {
    drill: SavedDrill;
    onStart: (configuration: Readonly<DrillConfiguration>) => void;
}

// Read-only view of a stored timer. The timer name is the page heading and lives in the DrillApp header.
export default function SavedDrillDetails({ drill, onStart }: SavedDrillDetailsProps) {
    return (
        <section className="space-y-6">
            <ul aria-label="Timer parameters" className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-sm">
                {describeDrillConfiguration(drill.configuration).map((part) => (
                    <li key={part}>{part}</li>
                ))}
            </ul>
            <Button
                type="button"
                className="w-full"
                onClick={() => {
                    onStart(drill.configuration);
                }}
            >
                Start
            </Button>
            {/* The owner's actions. */}
            <div data-slot="saved-drill-actions" className="flex flex-wrap gap-2 empty:hidden">
                <a href={`/${drill.id}/edit`} className={cn(buttonVariants({ variant: "outline" }), "w-full")}>
                    Edit timer
                </a>
                <DeleteDrillDialog drill={{ id: drill.id, name: drill.name }} />
            </div>
            <a href="/dashboard" className={cn(buttonVariants({ variant: "link" }), "w-full")}>
                Back to dashboard
            </a>
        </section>
    );
}
