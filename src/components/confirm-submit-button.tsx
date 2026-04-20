"use client";

import { ButtonHTMLAttributes, MouseEvent } from "react";

type ConfirmSubmitButtonProps = {
  label: string;
  message: string;
  className?: string;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "onClick">;

export function ConfirmSubmitButton({ label, message, className, ...props }: ConfirmSubmitButtonProps) {
  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (!window.confirm(message)) {
      event.preventDefault();
    }
  };

  return (
    <button type="submit" className={className} onClick={handleClick} {...props}>
      {label}
    </button>
  );
}
