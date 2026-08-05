import { handlers } from "@/auth";

// Auth.js v5 catch-all. Serves /api/auth/signin, /callback/*, /session, /csrf,
// /signout, /providers. The app's own explicit routes (/api/auth/register,
// /login, /me, /otp/*, /reset-*) are more specific segments and take precedence,
// so they keep working alongside this handler.
export const { GET, POST } = handlers;
