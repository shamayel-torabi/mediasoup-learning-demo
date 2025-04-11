import { forwardRef, type ComponentPropsWithoutRef } from "react";
import { twMerge } from "tailwind-merge";

const Card = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<"div">>(({ children, className, ...props }, ref) => {
    const cls = twMerge('p-5 bg-white border border-gray-200 rounded-lg shadow-sm dark:bg-gray-800 dark:border-gray-700', className)

    return (
        <div className={cls} {...props} ref={ref}>
            {children}
        </div>
    );
});

Card.displayName = "Card"
export { Card }
