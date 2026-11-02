import { redirect } from "next/navigation";
import { getSession, ServerApiError } from "@/lib/server-api";
import { PublicNav, Footer } from "@/components/marketing/public";
import { OnboardingForm } from "@/components/onboarding-form";
export default async function Page() {
  try {
    await getSession();
  } catch (e) {
    if (e instanceof ServerApiError && e.status === 401)
      redirect("/login?next=/onboarding");
    throw e;
  }
  return (
    <>
      <PublicNav />
      <OnboardingForm />
      <Footer />
    </>
  );
}
