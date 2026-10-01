import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const alertVariants = cva(
    "relative flex w-full flex-col gap-1 rounded-lg border px-4 py-3 text-sm has-[>svg]:pl-11 [&>svg]:absolute [&>svg]:top-3 [&>svg]:left-4 [&>svg]:size-4 [&>svg]:text-current",
    {
        variants: {
            variant: {
                default: "bg-card text-card-foreground",
                destructive: "bg-card text-destructive *:data-[slot=alert-description]:text-destructive/90 [&>svg]:text-current",
            },
        },
        defaultVariants: {
            variant: "default",
        },
    },
);

function Alert({ className, variant, ...props }: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
    return <div data-slot="alert" role="alert" className={cn(alertVariants({ variant }), className)} {...props} />;
}

function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
    return <div data-slot="alert-title" className={cn("line-clamp-1 min-h-4 font-medium tracking-tight", className)} {...props} />;
}

function AlertDescription({ className, ...props }: React.ComponentProps<"div">) {
    return <div data-slot="alert-description" className={cn("text-muted-foreground grid justify-items-start gap-1 text-sm [&_p]:leading-relaxed", className)} {...props} />;
}

export { Alert, AlertTitle, AlertDescription };
