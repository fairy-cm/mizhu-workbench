/** Shared long-lived auth cookie options (~400 days, browser max). */
export const authCookieOptions = {
  path: "/",
  sameSite: "lax" as const,
  maxAge: 60 * 60 * 24 * 400,
};
