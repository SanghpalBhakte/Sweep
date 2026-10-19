import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import { subscriptionKeys } from "@/lib/subscriptions/queryKeys";
import {
  mapCategoryToOption,
  mapPaymentMethodToOption,
} from "@/lib/subscriptions/mappers";
import type { CategoryRow, PaymentMethodRow } from "@/lib/subscriptions/types";
import { withBuiltinPaymentMethods } from "@/lib/constants/paymentMethods";
import type { PaymentMethod } from "@/lib/types";
import { CANONICAL_CATEGORIES } from "@/lib/constants/categories";

async function fetchCategories(): Promise<CategoryRow[]> {
  const { data, error } = await supabase
    .from("categories")
    .select("id, slug, name, color, icon, created_at, user_id")
    .order("name", { ascending: true });

  const dbList = (data as unknown as CategoryRow[]) ?? [];
  const dbSlugs = new Set(dbList.map((c) => c.slug));
  const dbIds = new Set(dbList.map((c) => c.id));

  const merged: CategoryRow[] = [...dbList];
  for (const canon of CANONICAL_CATEGORIES) {
    if (!dbSlugs.has(canon.slug) && !dbIds.has(canon.id)) {
      merged.push({
        id: canon.id,
        user_id: null,
        name: canon.name,
        slug: canon.slug,
        color: canon.color,
        icon: canon.icon,
        created_at: canon.created_at,
      });
    }
  }

  return merged.sort((a, b) => a.name.localeCompare(b.name));
}

async function fetchPaymentMethods(): Promise<PaymentMethodRow[]> {
  const { data, error } = await supabase
    .from("payment_methods")
    .select("id, user_id, name, type, last4, color, is_default, created_at")
    .order("is_default", { ascending: false })
    .order("name", { ascending: true });

  if (error) {
    throw error;
  }

  // Built-in methods (UPI, cards, PayPal…) are always offered, even before the
  // database has its shared rows.
  return withBuiltinPaymentMethods(
    ((data as unknown as PaymentMethodRow[]) ?? []) as unknown as PaymentMethod[]
  ) as unknown as PaymentMethodRow[];
}

export function useSubscriptionLookups() {
  const categoriesQuery = useQuery({
    queryKey: subscriptionKeys.categories(),
    queryFn: fetchCategories,
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 60,
  });

  const paymentMethodsQuery = useQuery({
    queryKey: subscriptionKeys.paymentMethods(),
    queryFn: fetchPaymentMethods,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
  });

  const categoryOptions = useMemo(
    () => (categoriesQuery.data ?? []).map(mapCategoryToOption),
    [categoriesQuery.data]
  );

  const paymentMethodOptions = useMemo(
    () => (paymentMethodsQuery.data ?? []).map(mapPaymentMethodToOption),
    [paymentMethodsQuery.data]
  );

  return {
    categories: categoriesQuery.data ?? [],
    paymentMethods: paymentMethodsQuery.data ?? [],
    categoryOptions,
    paymentMethodOptions,
    hasPaymentMethods: (paymentMethodsQuery.data ?? []).length > 0,
    isLoading: categoriesQuery.isLoading || paymentMethodsQuery.isLoading,
    isFetching: categoriesQuery.isFetching || paymentMethodsQuery.isFetching,
    isError: categoriesQuery.isError || paymentMethodsQuery.isError,
    error: categoriesQuery.error ?? paymentMethodsQuery.error ?? null,
    refetchAll: async () => {
      await Promise.all([
        categoriesQuery.refetch(),
        paymentMethodsQuery.refetch(),
      ]);
    },
  };
}
