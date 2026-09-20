"use client";

import Script from "next/script";
import { LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

type PaddleEvent = { name?: string };
type PaddleGlobal = {
  Environment: { set: (environment: "sandbox") => void };
  Checkout: { open: (options: { transactionId: string }) => void };
  Initialize: (options: {
    token: string;
    eventCallback?: (event: PaddleEvent) => void;
    checkout?: { settings?: { displayMode?: "overlay"; theme?: "light" | "dark"; locale?: string } };
  }) => void;
};

declare global {
  interface Window {
    Paddle?: PaddleGlobal;
    __aliDropifyPaddleInitialized?: boolean;
    __aliDropifyPaddleCompleted?: () => void;
  }
}

export function PaddleCheckout({
  clientToken,
  environment,
  locale,
  orderId,
  loadingLabel,
  errorLabel,
}: {
  clientToken: string;
  environment: "sandbox" | "live";
  locale: "en" | "ar";
  orderId: string;
  loadingLabel: string;
  errorLabel: string;
}) {
  const router = useRouter();
  const [error, setError] = useState(false);

  function initialize() {
    try {
      if (!window.Paddle) throw new Error("Paddle.js did not load");
      window.__aliDropifyPaddleCompleted = () => {
        router.push(`/${locale}/checkout/success?order=${encodeURIComponent(orderId)}`);
      };
      if (!window.__aliDropifyPaddleInitialized) {
        if (environment === "sandbox") window.Paddle.Environment.set("sandbox");
        window.Paddle.Initialize({
          token: clientToken,
          checkout: { settings: { displayMode: "overlay", theme: "light", locale: "en" } },
          eventCallback: (event) => {
            if (event.name === "checkout.completed") window.__aliDropifyPaddleCompleted?.();
          },
        });
        window.__aliDropifyPaddleInitialized = true;
      } else {
        const transactionId = new URLSearchParams(window.location.search).get("_ptxn");
        if (transactionId?.startsWith("txn_")) {
          window.Paddle.Checkout.open({ transactionId });
        }
      }
    } catch (caught) {
      console.error("Paddle checkout initialization failed", caught);
      setError(true);
    }
  }

  return (
    <div className="container-shell flex min-h-[60vh] items-center justify-center py-16 text-center">
      <Script
        src="https://cdn.paddle.com/paddle/v2/paddle.js"
        strategy="afterInteractive"
        onReady={initialize}
        onError={() => setError(true)}
      />
      <div className="max-w-md rounded-xl border bg-card p-8">
        {error ? (
          <p className="font-semibold text-destructive">{errorLabel}</p>
        ) : (
          <>
            <LoaderCircle className="mx-auto size-8 animate-spin text-primary" />
            <p className="mt-4 font-semibold">{loadingLabel}</p>
          </>
        )}
      </div>
    </div>
  );
}
