"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export function FlashNotice({ message }: { message: string }) {
  const pathname = usePathname();
  const [text] = useState(message);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (!params.has("notice")) {
      return;
    }

    params.delete("notice");
    const query = params.toString();
    const next = query === "" ? pathname : `${pathname}?${query}`;
    window.history.replaceState(null, "", next);
  }, [pathname]);

  return (
    <p role="status" className="text-sm text-green-700 dark:text-green-400">
      {text}
    </p>
  );
}
