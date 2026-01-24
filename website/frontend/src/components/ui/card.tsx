"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  featured?: boolean;
  hover?: boolean;
}

export function Card({
  children,
  className,
  featured = false,
  hover = true,
}: CardProps) {
  return (
    <motion.div
      className={cn(
        "relative rounded-2xl p-6 border transition-all duration-300",
        "bg-surface-card border-white/5",
        featured &&
          "border-primary-500/50 bg-gradient-to-b from-primary-500/10 to-transparent",
        hover && "hover:border-primary-500/30 hover:shadow-xl",
        className
      )}
      whileHover={
        hover
          ? {
              y: -4,
              boxShadow: "0 0 40px rgba(6, 182, 212, 0.15)",
            }
          : undefined
      }
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
    >
      {children}
    </motion.div>
  );
}

interface CardHeaderProps {
  children: React.ReactNode;
  className?: string;
}

export function CardHeader({ children, className }: CardHeaderProps) {
  return <div className={cn("mb-4", className)}>{children}</div>;
}

interface CardTitleProps {
  children: React.ReactNode;
  className?: string;
}

export function CardTitle({ children, className }: CardTitleProps) {
  return (
    <h3 className={cn("text-xl font-bold text-white", className)}>{children}</h3>
  );
}

interface CardDescriptionProps {
  children: React.ReactNode;
  className?: string;
}

export function CardDescription({ children, className }: CardDescriptionProps) {
  return (
    <p className={cn("text-gray-400 leading-relaxed", className)}>{children}</p>
  );
}
