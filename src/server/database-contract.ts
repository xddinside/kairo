export const isIsolatedDatabaseTestUrl = (candidate: string): boolean => {
  try {
    const url = new URL(candidate);
    if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") return false;

    const target = `${url.hostname}${url.pathname}`.toLowerCase();
    if (/(^|[^a-z])prod(uction)?([^a-z]|$)/.test(target)) return false;

    return (
      url.hostname === "localhost" ||
      url.hostname === "127.0.0.1" ||
      url.hostname.endsWith(".test") ||
      target.includes("preview") ||
      target.includes("test")
    );
  } catch {
    return false;
  }
};
