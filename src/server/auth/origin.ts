export type OriginFailureKind = "missing" | "malformed" | "wrong" | "configuration";

export type OriginCheck =
  | Readonly<{ readonly ok: true }>
  | Readonly<{ readonly ok: false; readonly reason: OriginFailureKind }>;

const safeMethods = new Set(["GET", "HEAD", "OPTIONS"]);
const privateRouteRoots = [
  "/canvas",
  "/courses",
  "/files",
  "/focus",
  "/notes",
  "/tasks",
  "/timetable",
] as const;

export type RequestHandlerType = "router" | "serverFn";

const parseWebOrigin = (value: string): URL | undefined => {
  try {
    const parsed = new URL(value);
    if (
      parsed.origin !== value ||
      (parsed.protocol !== "http:" && parsed.protocol !== "https:") ||
      parsed.username !== "" ||
      parsed.password !== "" ||
      parsed.pathname !== "/" ||
      parsed.search !== "" ||
      parsed.hash !== ""
    ) {
      return undefined;
    }
    return parsed;
  } catch {
    return undefined;
  }
};

export const readCanonicalOrigin = (
  environment = process.env.KAIRO_ENV ?? "local",
  rawOrigin = process.env.KAIRO_ORIGIN,
): URL | undefined => {
  if (rawOrigin === undefined) {
    return environment === "production" ? undefined : new URL("http://localhost:4173");
  }

  return parseWebOrigin(rawOrigin);
};

export const isUnsafeRequest = (request: Request): boolean => !safeMethods.has(request.method.toUpperCase());

export const requiresCanonicalOrigin = (
  request: Request,
  handlerType: RequestHandlerType,
  pathname: string,
): boolean =>
  isUnsafeRequest(request) &&
  (handlerType === "serverFn" || (handlerType === "router" && isPrivateRoute(pathname)));

export const checkCanonicalOrigin = (
  request: Request,
  canonicalOrigin: URL | undefined,
): OriginCheck => {
  if (!isUnsafeRequest(request)) return { ok: true };
  if (!canonicalOrigin) return { ok: false, reason: "configuration" };

  const rawOrigin = request.headers.get("Origin");
  if (rawOrigin === null) return { ok: false, reason: "missing" };

  const requestOrigin = parseWebOrigin(rawOrigin);
  if (!requestOrigin) return { ok: false, reason: "malformed" };
  if (requestOrigin.origin !== canonicalOrigin.origin) return { ok: false, reason: "wrong" };

  const fetchSite = request.headers.get("Sec-Fetch-Site");
  if (fetchSite !== null && fetchSite !== "same-origin") return { ok: false, reason: "wrong" };

  return { ok: true };
};

export const isPublicAuthRoute = (pathname: string): boolean =>
  pathname === "/sign-in" || pathname.startsWith("/sign-in/");

export const isPrototypeRoute = (pathname: string): boolean =>
  pathname === "/proto" || pathname.startsWith("/proto/");

export const isPrivateRoute = (pathname: string): boolean => {
  if (pathname === "/") return false;
  if (isPublicAuthRoute(pathname) || isPrototypeRoute(pathname)) return false;

  return privateRouteRoots.some(
    (root) => pathname === root || pathname.startsWith(`${root}/`),
  );
};
