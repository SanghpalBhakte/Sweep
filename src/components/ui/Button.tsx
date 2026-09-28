import React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils/cn';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'icon';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:   'sweep-btn-primary',
  secondary: 'sweep-btn-secondary',
  ghost:     'sweep-btn-ghost',
  outline:   'sweep-btn-outline',
  danger:    'sweep-btn-danger',
};

const sizeStyles: Record<ButtonSize, string> = {
  xs:   'px-2.5 py-1 text-[11px] min-h-[1.75rem] max-md:min-h-[2.75rem] rounded-sm gap-1',
  sm:   'px-3 py-1.5 text-xs min-h-[2rem] max-md:min-h-[2.75rem] rounded-md gap-1.5',
  md:   'px-4 py-2 text-sm min-h-[2.5rem] max-md:min-h-[2.75rem] rounded-btn gap-2',
  lg:   'px-5 py-2.5 text-sm min-h-[2.875rem] max-md:min-h-[2.75rem] rounded-btn gap-2',
  icon: 'p-2 min-h-[2.25rem] min-w-[2.25rem] max-md:min-h-[2.75rem] max-md:min-w-[2.75rem] rounded-btn',
};

export function buttonClassName({
  variant = 'secondary',
  size = 'md',
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}) {
  return cn(
    'sweep-btn font-medium transition-all inline-flex items-center justify-center',
    variantStyles[variant],
    sizeStyles[size],
    className
  );
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'secondary',
      size = 'md',
      isLoading = false,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={buttonClassName({ variant, size, className })}
        {...props}
      >
        {isLoading ? (
          <span className="inline-block w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin shrink-0" />
        ) : null}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';

export type ButtonLinkProps = React.ComponentProps<typeof Link> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

// A link that looks like a button. Use this instead of wrapping <Button> in <Link>,
// which puts a button inside a link (invalid HTML and two tab stops for one action).
export function ButtonLink({ variant = 'secondary', size = 'md', className, ...props }: ButtonLinkProps) {
  return <Link className={buttonClassName({ variant, size, className })} {...props} />;
}
