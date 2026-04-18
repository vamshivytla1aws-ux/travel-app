"use client";

import { useEffect, useState } from "react";
import { UserCircle2 } from "lucide-react";
import { cn } from "@/lib/ui-core";

type ProfileAvatarProps = {
  name: string;
  src?: string | null;
  className?: string;
};

/**
 * User-uploaded photos use a plain <img> (not next/image) so we are not limited to
 * next/image remote patterns and MIME validation. HEIC and odd types still may not
 * render in some browsers; onError falls back to the placeholder icon.
 */
export function ProfileAvatar({ name, src, className }: ProfileAvatarProps) {
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    setLoadFailed(false);
  }, [src]);

  if (src && !loadFailed) {
    return (
      <div className={cn("relative h-16 w-16 overflow-hidden rounded-full border bg-muted", className)}>
        {/* eslint-disable-next-line @next/next/no-img-element -- user-uploaded bytes; next/image rejects some MIME types */}
        <img
          src={src}
          alt={name}
          className="h-full w-full object-cover"
          onError={() => setLoadFailed(true)}
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex h-16 w-16 items-center justify-center rounded-full border bg-muted text-muted-foreground",
        className,
      )}
      aria-label={`${name} profile placeholder`}
    >
      <UserCircle2 className="h-10 w-10" />
    </div>
  );
}
