import { useEffect } from "react";
import { useLocation } from "wouter";
import { useProductAccess } from "@/hooks/useProductAccess";

interface ActiveClientRouteProps {
  children: React.ReactNode;
}

export function ActiveClientRoute({ children }: ActiveClientRouteProps) {
  const { hasExcellenceLab, hasEvidenceVault, hasEliteBlueprint, isLoading } =
    useProductAccess();
  const [, navigate] = useLocation();

  const hasAnyProduct = hasExcellenceLab || hasEvidenceVault || hasEliteBlueprint;

  useEffect(() => {
    if (!isLoading && !hasAnyProduct) {
      navigate("/choose-plan", { replace: true });
    }
  }, [isLoading, hasAnyProduct, navigate]);

  if (isLoading || !hasAnyProduct) return null;

  return <>{children}</>;
}
