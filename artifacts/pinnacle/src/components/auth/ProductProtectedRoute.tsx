import { useEffect } from "react";
import { useLocation } from "wouter";
import { useProductAccess } from "@/hooks/useProductAccess";

interface ProductProtectedRouteProps {
  children: React.ReactNode;
  product: "excellence_lab" | "evidence_vault" | "elite_blueprint";
  redirectTo: string;
}

export function ProductProtectedRoute({ children, product, redirectTo }: ProductProtectedRouteProps) {
  const { hasExcellenceLab, hasEvidenceVault, hasEliteBlueprint, isLoading } = useProductAccess();
  const [, navigate] = useLocation();

  const hasAccess =
    product === "excellence_lab" ? hasExcellenceLab
    : product === "evidence_vault" ? hasEvidenceVault
    : hasEliteBlueprint;

  useEffect(() => {
    if (!isLoading && !hasAccess) {
      navigate(redirectTo, { replace: true });
    }
  }, [isLoading, hasAccess, navigate, redirectTo]);

  if (isLoading || !hasAccess) return null;

  return <>{children}</>;
}
