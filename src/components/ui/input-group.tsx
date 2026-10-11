import * as React from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

/**
 * Registry shadcn `input-group` (new-york), reduced to what the timer form needs (group, field, addon) and adapted to
 * the timer UI contract: one border and one focus ring for the whole group, error state on the group, tokens only.
 */
function InputGroup({ className, ...props }: React.ComponentProps<"div">) {
    return (
        <div
            data-slot="input-group"
            className={cn(
                "group/input-group border-input dark:bg-input/30 relative flex h-9 w-full min-w-0 items-center rounded-md border shadow-xs transition-[color,box-shadow] outline-none",
                "has-[[data-slot=input-group-control]:focus-visible]:border-ring has-[[data-slot=input-group-control]:focus-visible]:ring-ring/50 has-[[data-slot=input-group-control]:focus-visible]:ring-2",
                "has-[[data-slot=input-group-control][aria-invalid=true]]:border-destructive has-[[data-slot=input-group-control][aria-invalid=true]]:ring-destructive/20 dark:has-[[data-slot=input-group-control][aria-invalid=true]]:ring-destructive/40 has-[[data-slot=input-group-control][aria-invalid=true]]:ring-2",
                className,
            )}
            {...props}
        />
    );
}

function InputGroupAddon({ className, ...props }: React.ComponentProps<"div">) {
    return <div data-slot="input-group-addon" className={cn("order-last flex h-full shrink-0 items-center", className)} {...props} />;
}

function InputGroupInput({ className, ...props }: React.ComponentProps<"input">) {
    return (
        <Input
            data-slot="input-group-control"
            className={cn("h-full flex-1 rounded-none border-0 bg-transparent shadow-none focus-visible:ring-0 dark:bg-transparent", className)}
            {...props}
        />
    );
}

export { InputGroup, InputGroupAddon, InputGroupInput };
