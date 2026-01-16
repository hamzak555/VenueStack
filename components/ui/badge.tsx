import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-full border px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive transition-[color,box-shadow] overflow-hidden",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground [a&]:hover:bg-primary/90",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/90",
        destructive:
          "border-red-500 bg-red-500/10 text-red-700 dark:text-red-400 dark:bg-red-500/20 [a&]:hover:bg-red-500/20",
        success:
          "border-green-500 bg-green-500/10 text-green-700 dark:text-green-400 dark:bg-green-500/20 [a&]:hover:bg-green-500/20",
        teal:
          "border-teal-500 bg-teal-500/10 text-teal-700 dark:text-teal-400 dark:bg-teal-500/20 [a&]:hover:bg-teal-500/20",
        warning:
          "border-yellow-500 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 dark:bg-yellow-500/20 [a&]:hover:bg-yellow-500/20",
        orange:
          "border-orange-500 bg-orange-500/10 text-orange-700 dark:text-orange-400 dark:bg-orange-500/20 [a&]:hover:bg-orange-500/20",
        purple:
          "border-purple-500 bg-purple-500/10 text-purple-700 dark:text-purple-400 dark:bg-purple-500/20 [a&]:hover:bg-purple-500/20",
        info:
          "border-blue-500 bg-blue-500/10 text-blue-700 dark:text-blue-400 dark:bg-blue-500/20 [a&]:hover:bg-blue-500/20",
        outline:
          "text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span"

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
