import { createClient } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const cookieHeader = request.headers.get("cookie") ?? "";
        const match = cookieHeader.match(/kurrnt-interests=([^;]+)/);
        if (match) {
          try {
            const interests = JSON.parse(decodeURIComponent(match[1])) as string[];
            if (Array.isArray(interests) && interests.length > 0) {
              await supabase.auth.updateUser({
                data: { interests },
              });
            }
          } catch {
            // Ignore parse errors
          }
        }
      }

      const response = NextResponse.redirect(`${origin}/feed`);
      response.cookies.set("kurrnt-interests", "", { maxAge: 0, path: "/" });
      return response;
    }
  }

  return NextResponse.redirect(`${origin}/onboarding?error=auth`);
}
