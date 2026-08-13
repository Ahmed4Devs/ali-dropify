"use client";

import { useState, useTransition } from "react";
import { ArrowRight, LoaderCircle, MailCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  passwordSignInAction,
  sendSignInCodeAction,
  signUpAction,
  verifySignInCodeAction,
} from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from "@/i18n/navigation";
import type { AuthFormProps } from "@/types";

export function SignInForm({ locale }: AuthFormProps) {
  const t = useTranslations("auth.signIn");
  const router = useRouter();
  const common = useTranslations("common");
  const mutationErrors = useTranslations("mutationErrors");
  const [pending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);

  function passwordSignIn() {
    startTransition(async () => {
      const result = await passwordSignInAction({ email, password });
      if (result.ok) {
        router.push(`/${locale}/account`);
        router.refresh();
      }
      else toast.error(mutationErrors(result.error));
    });
  }

  function sendCode() {
    startTransition(async () => {
      const result = await sendSignInCodeAction({ email });
      if (result.ok) {
        setCodeSent(true);
        toast.success(t("codeSent", { email }));
      } else {
        toast.error(mutationErrors(result.error));
      }
    });
  }

  function verifyCode() {
    startTransition(async () => {
      const result = await verifySignInCodeAction({ email, otp: code });
      if (result.ok) {
        router.push(`/${locale}/account`);
        router.refresh();
      }
      else toast.error(mutationErrors(result.error));
    });
  }

  return (
    <Tabs defaultValue="password">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="password">{t("passwordTab")}</TabsTrigger>
        <TabsTrigger value="code">{t("otpTab")}</TabsTrigger>
      </TabsList>
      <TabsContent value="password" className="mt-6">
        <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); passwordSignIn(); }}>
          <div className="space-y-2">
            <Label htmlFor="sign-in-email">{common("email")}</Label>
            <Input id="sign-in-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sign-in-password">{t("password")}</Label>
            <Input id="sign-in-password" type="password" autoComplete="current-password" required minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} />
          </div>
          <Button type="submit" size="lg" className="w-full" disabled={pending}>
            {pending ? <LoaderCircle className="size-4 animate-spin" /> : <ArrowRight className="size-4 rtl:rotate-180" />}
            {pending ? t("submitting") : t("submit")}
          </Button>
        </form>
      </TabsContent>
      <TabsContent value="code" className="mt-6">
        <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); if (codeSent) verifyCode(); else sendCode(); }}>
          <div className="space-y-2">
            <Label htmlFor="code-email">{common("email")}</Label>
            <Input id="code-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
          </div>
          {codeSent && (
            <div className="space-y-2">
              <Label htmlFor="sign-in-code">{t("codeLabel")}</Label>
              <Input id="sign-in-code" inputMode="numeric" required minLength={6} maxLength={6} placeholder={t("codePlaceholder")} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} />
            </div>
          )}
          <Button type="submit" size="lg" className="w-full" disabled={pending}>
            {pending ? <LoaderCircle className="size-4 animate-spin" /> : <MailCheck className="size-4" />}
            {pending ? (codeSent ? t("verifyingCode") : t("sendingCode")) : (codeSent ? t("verifyCode") : t("sendCode"))}
          </Button>
        </form>
      </TabsContent>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        {t("noAccount")} <Link className="font-semibold text-primary hover:underline" href="/sign-up">{t("createAccount")}</Link>
      </p>
    </Tabs>
  );
}

export function SignUpForm({ locale }: AuthFormProps) {
  void locale;
  const t = useTranslations("auth.signUp");
  const common = useTranslations("common");
  const mutationErrors = useTranslations("mutationErrors");
  const [pending, startTransition] = useTransition();
  const [sentTo, setSentTo] = useState("");
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", password: "" });

  function submit() {
    startTransition(async () => {
      const result = await signUpAction(form);
      if (result.ok) setSentTo(result.data.email);
      else toast.error(mutationErrors(result.error));
    });
  }

  if (sentTo) {
    return (
      <div className="text-center">
        <span className="mx-auto grid size-16 place-items-center rounded-full bg-accent text-primary"><MailCheck className="size-8" /></span>
        <h2 className="mt-5 text-xl font-bold">{t("successTitle")}</h2>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">{t("successDescription", { email: sentTo })} {t("verificationLogged")}</p>
        <Button asChild className="mt-6"><Link href="/sign-in">{t("signIn")}</Link></Button>
      </div>
    );
  }

  return (
    <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); submit(); }}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2"><Label htmlFor="first-name">{common("firstName")}</Label><Input id="first-name" autoComplete="given-name" required minLength={2} value={form.firstName} onChange={(event) => setForm((current) => ({ ...current, firstName: event.target.value }))} /></div>
        <div className="space-y-2"><Label htmlFor="last-name">{common("lastName")}</Label><Input id="last-name" autoComplete="family-name" required minLength={2} value={form.lastName} onChange={(event) => setForm((current) => ({ ...current, lastName: event.target.value }))} /></div>
      </div>
      <div className="space-y-2"><Label htmlFor="sign-up-email">{common("email")}</Label><Input id="sign-up-email" type="email" autoComplete="email" required value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} /></div>
      <div className="space-y-2"><Label htmlFor="sign-up-password">{t("password")}</Label><Input id="sign-up-password" type="password" autoComplete="new-password" required minLength={8} value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} /><p className="text-xs text-muted-foreground">{t("passwordHint")}</p></div>
      <Button type="submit" size="lg" className="w-full" disabled={pending}>{pending && <LoaderCircle className="size-4 animate-spin" />}{pending ? t("submitting") : t("submit")}</Button>
      <p className="text-center text-sm text-muted-foreground">{t("hasAccount")} <Link className="font-semibold text-primary hover:underline" href="/sign-in">{t("signIn")}</Link></p>
    </form>
  );
}
