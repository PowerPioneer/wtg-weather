import { forwardRef } from "react";
import type { ButtonHTMLAttributes, AnchorHTMLAttributes, ReactNode } from "react";
import { tv, type VariantProps } from "tailwind-variants";

import { cn } from "@/lib/cn";

const button = tv({
  base: [
    "inline-flex items-center justify-center gap-2 rounded-md font-sans font-medium",
    "transition-colors duration-fast ease-standard",
    "disabled:pointer-events-none disabled:opacity-50",
    "focus-visible:outline-focus-ring",
  ].join(" "),
  variants: {
    variant: {
      primary:
        "bg-primary text-primary-foreground hover:bg-primary-hover active:bg-primary-pressed",
      secondary:
        "bg-surface text-text border border-border-strong hover:bg-surface-2",
      ghost: "bg-transparent text-text hover:bg-surface-2",
      destructive:
        "bg-destructive text-destructive-foreground hover:brightness-110",
      link: "bg-transparent text-text-link underline-offset-4 hover:underline px-0 h-auto",
    },
    size: {
      sm: "h-8 px-3 text-body-sm",
      md: "h-10 px-4 text-body-sm",
      lg: "h-12 px-6 text-body",
    },
    fullWidth: {
      true: "w-full",
      false: "",
    },
  },
  compoundVariants: [
    { variant: "link", size: "sm", class: "h-auto px-0" },
    { variant: "link", size: "md", class: "h-auto px-0" },
    { variant: "link", size: "lg", class: "h-auto px-0" },
  ],
  defaultVariants: {
    variant: "primary",
    size: "md",
    fullWidth: false,
  },
});

type ButtonVariants = VariantProps<typeof button>;

type CommonProps = {
  variant?: ButtonVariants["variant"];
  size?: ButtonVariants["size"];
  fullWidth?: boolean;
  loading?: boolean;
  icon?: ReactNode;
  iconAfter?: ReactNode;
  children?: ReactNode;
  className?: string;
};

type ButtonAsButton = CommonProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof CommonProps> & {
    as?: "button";
  };

type ButtonAsAnchor = CommonProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof CommonProps> & {
    as: "a";
    href: string;
  };

export type ButtonProps = ButtonAsButton | ButtonAsAnchor;

export const Button = forwardRef<HTMLButtonElement | HTMLAnchorElement, ButtonProps>(
  function Button(props, ref) {
    const {
      variant,
      size,
      fullWidth,
      loading,
      icon,
      iconAfter,
      className,
      children,
      ...rest
    } = props;

    const classes = cn(button({ variant, size, fullWidth }), className);
    const inner = (
      <>
        {loading ? <Spinner /> : icon}
        {children}
        {iconAfter}
      </>
    );

    if (props.as === "a") {
      const { as: _asAnchor, ...anchorRest } = rest as AnchorHTMLAttributes<HTMLAnchorElement> & {
        as?: "a";
      };
      void _asAnchor;
      return (
        <a
          ref={ref as React.Ref<HTMLAnchorElement>}
          className={classes}
          aria-busy={loading || undefined}
          {...anchorRest}
        >
          {inner}
        </a>
      );
    }

    const { as: _asButton, ...buttonRest } = rest as ButtonHTMLAttributes<HTMLButtonElement> & {
      as?: "button";
    };
    void _asButton;
    return (
      <button
        ref={ref as React.Ref<HTMLButtonElement>}
        className={classes}
        aria-busy={loading || undefined}
        disabled={loading || (buttonRest as { disabled?: boolean }).disabled}
        {...buttonRest}
      >
        {inner}
      </button>
    );
  },
);

function Spinner() {
  return (
    <span
      aria-hidden="true"
      className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
    />
  );
}
