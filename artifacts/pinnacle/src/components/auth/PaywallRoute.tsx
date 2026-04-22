import { useEffect } from "react";
import { useLocation } from "wouter";
import { useProductAccess } from "@/hooks/useProductAccess";

interface PaywallRouteProps {
  children: React.ReactNode;
}

export function PaywallRoute({ children }: PaywallRouteProps) {
  const { hasExcellenceLab, isLoading } = useProductAccess();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!isLoading && !hasExcellenceLab) {
      navigate("/choose-plan", { replace: true });
    }
  }, [isLoading, hasExcellenceLab, navigate]);

  if (isLoading || !hasExcellenceLab) return null;

  return <>{children}</>;
}
