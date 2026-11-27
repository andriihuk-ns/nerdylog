import { inlineLinks } from "@/contracts";
import { faviconUrl } from "@/components/shell/artifact-text";

/** A whole URL with a dotted host, so half-typed addresses do not request favicons. */
function faviconFor(value: string): string | null {
  const url = value.trim();
  if (inlineLinks(url)[0] !== url || !/^https?:\/\/[^/?#]+\.[a-z]{2,}([:/?#]|$)/i.test(url)) return null;
  return faviconUrl(url);
}

/** Fixed slot before a link input: the space is kept while there is no link yet. */
export function LinkFavicon({ url }: { url: string }) {
  const favicon = faviconFor(url);
  return (
    <span aria-hidden className="flex size-4 shrink-0 items-center justify-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {favicon ? <img src={favicon} alt="" className="size-4 rounded-[2px]" /> : null}
    </span>
  );
}
