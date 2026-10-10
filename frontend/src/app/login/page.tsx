import { LoginForm } from "@/components/login-form";

export default function Page() {
  return (
    <div className="flex min-h-svh w-full items-center justify-center bg-muted/30 p-6 md:p-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 grid size-11 place-items-center rounded-xl bg-primary font-bold text-primary-foreground">
            N
          </div>
          <h1 className="text-xl font-bold">NeoStats</h1>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
