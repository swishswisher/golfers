import { PublicNav, Footer } from "@/components/marketing/public";
import { AuthForm } from "@/components/auth-forms";
export default function Page() {
  return (
    <>
      <PublicNav />
      <AuthForm mode="resend-verification" />
      <Footer />
    </>
  );
}
