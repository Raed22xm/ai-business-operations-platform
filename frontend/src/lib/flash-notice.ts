export function withNotice(href: string, notice: string): string {
  const trimmed = notice.trim();
  if (trimmed === "") {
    return href;
  }

  const params = new URLSearchParams(href.includes("?") ? href.slice(href.indexOf("?") + 1) : "");
  params.set("notice", trimmed);
  const path = href.includes("?") ? href.slice(0, href.indexOf("?")) : href;
  return `${path}?${params.toString()}`;
}

export function noticeValue(value: string | string[] | undefined): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  const trimmed = raw?.trim() ?? "";
  return trimmed === "" ? null : trimmed;
}
