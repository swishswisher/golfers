import { PublicNav, Footer } from "@/components/marketing/public";
import { AuthForm } from "@/components/auth-forms";
export const metadata = { title: "Signup" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  return (
    <>
      <PublicNav />
      <AuthForm
        mode="signup"
        params={params}
        demo={
          process.env.NODE_ENV === "development" &&
          process.env.NEXT_PUBLIC_DEMO_MODE === "true"
        }
      />
      <Footer />
    </>
  );
}
