import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-20 w-full rounded-lg border border-white/10 bg-[#06111d]/70 px-3 py-2 text-base text-[#eee9dd] transition-colors outline-none placeholder:text-[#627184] focus-visible:border-[#d9b966]/55 focus-visible:ring-2 focus-visible:ring-[#d9b966]/15 disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
