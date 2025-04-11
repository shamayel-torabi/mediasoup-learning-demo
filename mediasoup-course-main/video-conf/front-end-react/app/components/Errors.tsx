import type { ComponentProps } from "react";
import { twMerge } from "tailwind-merge";

interface ErrorsProps extends ComponentProps<"div"> {
    errors?: string[],
    className?: string
}

const Errors = ({ errors, className, ...props }: ErrorsProps) => {
    if (!errors?.length) return null;

    const cls = twMerge('text-red-500 text-sm py-2.5', className)

    return (
        <div className={cls} {...props}>
            {errors.map((err, i) => <p key={i}>{err}</p>)}
        </div>
    );
};

Errors.displayName = "Error"
export { Errors }
