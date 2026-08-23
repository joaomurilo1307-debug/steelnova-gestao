export { default } from "next-auth/middleware";

export const config = {
  matcher: ["/((?!api|login|_next/static|_next/image|manifest.webmanifest|sw.js|icon-.*\\.png|apple-touch-icon.png).*)"],
};
