"use client";

import { MouseEvent } from "react";

type ConfirmSubmitButtonProps = {
  label: string;
  message: string;
  className?: string;
};

export function ConfirmSubmitButton({ label, message, className }: ConfirmSubmitButtonProps) {
  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (!window.confirm(message)) {
      event.preventDefault();
    }
  };

  return (
    <button type="submit" className={className} onClick={handleClick}>
      {label}
    </button>
  );
}
