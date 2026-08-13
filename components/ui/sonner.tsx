"use client";

import * as React from "react";
import {
  AlertCircleIcon,
  CheckCircle2Icon,
  InfoIcon,
  LoaderCircleIcon,
  XCircleIcon,
} from "lucide-react";
import { Toaster as Sonner } from "sonner";

import { cn } from "@/lib/utils";

function Toaster({
  className,
  icons,
  toastOptions,
  ...props
}: React.ComponentProps<typeof Sonner>) {
  return (
    <Sonner
      className={cn("toaster group", className)}
      icons={
        icons ?? {
          success: <CheckCircle2Icon className="size-4" />,
          info: <InfoIcon className="size-4" />,
          warning: <AlertCircleIcon className="size-4" />,
          error: <XCircleIcon className="size-4" />,
          loading: <LoaderCircleIcon className="size-4 animate-spin" />,
        }
      }
      toastOptions={{
        ...toastOptions,
        classNames: {
          toast:
            "group toast border-border bg-background text-foreground shadow-lg",
          description: "text-muted-foreground",
          actionButton: "bg-primary text-primary-foreground",
          cancelButton: "bg-muted text-muted-foreground",
          ...toastOptions?.classNames,
        },
      }}
      {...props}
    />
  );
}

export { Toaster };
