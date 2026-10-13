// Only same-site relative paths are accepted for post-action redirects.
export function safeBack(fd: FormData, fallback: string) {
  const v = fd.get("back");
  return typeof v === "string" && /^\/(?!\/)[^\s]*$/.test(v) ? v : fallback;
}
