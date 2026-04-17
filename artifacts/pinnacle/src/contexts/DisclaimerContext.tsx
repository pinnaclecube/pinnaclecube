import { createContext, useContext, useState, type ReactNode } from "react";

interface DisclaimerContextValue {
  requiresReconsent: boolean;
  setRequiresReconsent: (v: boolean) => void;
}

const DisclaimerContext = createContext<DisclaimerContextValue>({
  requiresReconsent: false,
  setRequiresReconsent: () => {},
});

export function DisclaimerProvider({ children }: { children: ReactNode }) {
  const [requiresReconsent, setRequiresReconsent] = useState(false);

  return (
    <DisclaimerContext.Provider value={{ requiresReconsent, setRequiresReconsent }}>
      {children}
    </DisclaimerContext.Provider>
  );
}

export function useDisclaimer() {
  return useContext(DisclaimerContext);
}
