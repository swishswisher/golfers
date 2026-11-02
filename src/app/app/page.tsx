import { redirect } from "next/navigation";
import { getSession } from "@/lib/server-api";
export default async function Page() {
  let session;
  try {
    session = await getSession();
  } catch {
    redirect("/login");
  }
  redirect(
    session.clubs.length
      ? "/app/" + session.clubs[0].id
      : session.isPlatformAdmin
        ? "/admin"
        : "/onboarding",
  );
}
