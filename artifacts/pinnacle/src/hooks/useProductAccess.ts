import { useAuth } from "@/contexts/AuthContext";

export function useProductAccess() {
  const { user, isLoading } = useAuth();

  const accessLevel = user?.accessLevel ?? "free";

  return {
    hasExcellenceLab: accessLevel === "excellence_lab" || accessLevel === "evidence_vault" || accessLevel === "elite_blueprint" || accessLevel === "full",
    hasEvidenceVault: accessLevel === "evidence_vault" || accessLevel === "elite_blueprint" || accessLevel === "full",
    hasEliteBlueprint: accessLevel === "elite_blueprint" || accessLevel === "full",
    isLoading,
    accessLevel,
  };
}
