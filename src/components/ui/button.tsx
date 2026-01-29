import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  // Fluent 2 base button styles
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md text-sm font-semibold transition-all duration-100 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]",
  {
    variants: {
      variant: {
        // Fluent 2 Primary/Accent button
        default:
          "bg-primary text-primary-foreground shadow-2 hover:bg-primary/90 hover:shadow-4",
        // Fluent 2 Danger button
        destructive:
          "bg-destructive text-destructive-foreground shadow-2 hover:bg-destructive/90",
        // Fluent 2 Outline/Secondary button
        outline:
          "border border-input bg-background hover:bg-muted hover:border-muted-foreground/30",
        // Fluent 2 Subtle button
        secondary:
          "bg-muted text-foreground hover:bg-muted/80",
        // Fluent 2 Transparent button
        ghost: "hover:bg-muted/60",
        // Fluent 2 Link style
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        // Fluent 2 sizes: Medium (default), Small, Large
        default: "h-8 px-3 py-1.5",
        sm: "h-7 px-2.5 text-xs",
        lg: "h-9 px-4",
        icon: "h-8 w-8",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
