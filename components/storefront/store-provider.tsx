"use client";

import { createContext, useContext, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { addToCartAction, removeCartItemAction, updateCartQuantityAction } from "@/actions/cart";
import { setCurrencyAction } from "@/actions/preferences";
import type { CurrencyCode, StoreContextValue, StoreProviderProps } from "@/types";
import { track } from "@/lib/analytics";
import { convertFromUsd } from "@/lib/currency";

const StoreContext = createContext<StoreContextValue | null>(null);

export function StoreProvider({
  children,
  locale,
  initialCurrency,
  rates,
  initialCart,
}: StoreProviderProps) {
  const router = useRouter();
  const t = useTranslations("cart");
  const mutationErrors = useTranslations("mutationErrors");
  const validation = useTranslations("validation");
  const [currency, setCurrencyState] = useState(initialCurrency);
  const [cart, setCart] = useState(initialCart);
  const [cartOpen, setCartOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [mutationPending, setMutationPending] = useState(false);
  const mutationInFlight = useRef(false);

  async function setCurrency(currencyCode: CurrencyCode) {
    const result = await setCurrencyAction(currencyCode);
    if (!result.ok) {
      toast.error(validation("invalidCurrency"));
      return;
    }
    setCurrencyState(result.data);
    startTransition(() => router.refresh());
  }

  async function addToCart(
    productId: string,
    variantId?: string | null,
    quantity = 1,
  ) {
    if (mutationInFlight.current) return false;
    mutationInFlight.current = true;
    setMutationPending(true);
    try {
      const result = await addToCartAction({ productId, variantId, quantity, locale });
      if (!result.ok) {
        toast.error(mutationErrors(result.error));
        return false;
      }
      setCart(result.data);
      const added = result.data.lines.find((line) => line.productId === productId && line.variantId === (variantId ?? null));
      track("add_to_cart", {
        content_ids: [productId],
        value: convertFromUsd((added?.unitPriceUsd ?? 0) * quantity, currency, rates) / 100,
        currency,
        quantity,
      });
      setCartOpen(true);
      toast.success(t("itemAdded"));
      return true;
    } finally {
      mutationInFlight.current = false;
      setMutationPending(false);
    }
  }

  async function updateQuantity(itemId: string, quantity: number) {
    if (mutationInFlight.current) return;
    mutationInFlight.current = true;
    setMutationPending(true);
    try {
      const result = await updateCartQuantityAction({ itemId, quantity, locale });
      if (result.ok) setCart(result.data);
      else toast.error(mutationErrors(result.error));
    } finally {
      mutationInFlight.current = false;
      setMutationPending(false);
    }
  }

  async function removeItem(itemId: string) {
    if (mutationInFlight.current) return;
    mutationInFlight.current = true;
    setMutationPending(true);
    try {
      const result = await removeCartItemAction({ itemId, locale });
      if (result.ok) setCart(result.data);
      else toast.error(mutationErrors(result.error));
    } finally {
      mutationInFlight.current = false;
      setMutationPending(false);
    }
  }

  return (
    <StoreContext.Provider
      value={{
        currency,
        rates,
        cart,
        cartOpen,
        pending: pending || mutationPending,
        setCurrency,
        setCartOpen,
        addToCart,
        updateQuantity,
        removeItem,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const value = useContext(StoreContext);
  if (!value) throw new Error("useStore must be used inside StoreProvider");
  return value;
}
