import { useEffect, useRef, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { useDrillDelete } from "@/components/hooks/useDrillDelete";
import { deleteDrillRequest, type DeleteDrillPort } from "@/lib/drill-delete-controller";
import { cn } from "@/lib/utils";

export interface DeleteDrillDialogPorts {
    /** Defaults to `DELETE /api/drills/{id}`; `/dev/timer-ui` injects deterministic ports. */
    deleteDrill?: DeleteDrillPort;
    /** Defaults to `location.replace`, so the deleted page leaves no history entry. */
    navigate?: (href: string) => void;
}

interface DeleteDrillDialogProps extends DeleteDrillDialogPorts {
    drill: { id: string; name: string };
    /** Fixtures render the open dialog without a click. */
    defaultOpen?: boolean;
}

function replaceLocation(href: string) {
    window.location.replace(href);
}

/** The owner's Delete action: a modal alert dialog that names the timer and sends the delete only on confirmation. */
export default function DeleteDrillDialog({ drill, deleteDrill, navigate = replaceLocation, defaultOpen = false }: DeleteDrillDialogProps) {
    const [open, setOpen] = useState(defaultOpen);
    const [port] = useState(() => deleteDrill ?? deleteDrillRequest(drill.id));
    const { status, failure, confirm, cancel } = useDrillDelete(port, navigate);
    const cancelRef = useRef<HTMLButtonElement>(null);
    const deleting = status === "deleting";

    useEffect(() => {
        // After a failure the focus stays inside the dialog, on the safe button, next to the alert.
        if (status === "error") cancelRef.current?.focus();
    }, [status]);

    function onOpenChange(next: boolean) {
        // Not dismissible while the request is in flight; the dialog closes through Cancel, Esc, or the navigation.
        if (!next && deleting) return;
        setOpen(next);
        if (!next) cancel();
    }

    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogTrigger asChild>
                <Button type="button" variant="outline" className="text-destructive hover:text-destructive w-full">
                    Delete timer
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader className="min-w-0">
                    <AlertDialogTitle>Delete timer?</AlertDialogTitle>
                    <AlertDialogDescription className="min-w-0">
                        <span className="text-foreground font-medium wrap-anywhere">“{drill.name}”</span> will be permanently deleted. This cannot be undone.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                {failure ? (
                    <Alert variant="destructive">
                        <AlertDescription>
                            <p>{failure.message}</p>
                            {failure.code === "unauthorized" ? (
                                <a
                                    href={`/auth/signin?next=${encodeURIComponent(`/${drill.id}`)}`}
                                    className={cn(buttonVariants({ variant: "outline", size: "sm" }), "text-foreground")}
                                >
                                    Sign in
                                </a>
                            ) : null}
                        </AlertDescription>
                    </Alert>
                ) : null}
                <AlertDialogFooter>
                    <AlertDialogCancel ref={cancelRef} aria-disabled={deleting || undefined}>
                        Cancel
                    </AlertDialogCancel>
                    <AlertDialogAction
                        variant="destructive"
                        // aria-disabled instead of disabled keeps the focus inside the dialog while the request runs.
                        aria-disabled={deleting || undefined}
                        className="text-destructive-foreground focus-visible:border-ring focus-visible:ring-ring/50 dark:bg-destructive dark:hover:bg-destructive/90 aria-disabled:pointer-events-none aria-disabled:opacity-50"
                        onClick={(event) => {
                            // Radix closes the dialog right after onClick; it must stay open until the result arrives.
                            event.preventDefault();
                            if (deleting) return;
                            confirm();
                        }}
                    >
                        {deleting ? "Deleting…" : "Delete"}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
