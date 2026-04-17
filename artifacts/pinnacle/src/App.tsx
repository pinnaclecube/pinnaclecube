import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider, QueryCache } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

import Home from "@/pages/Home";
import HowItWorks from "@/pages/how-it-works";
import Products from "@/pages/products";
import Dashboard from "@/pages/dashboard";
import WhereYouStand from "@/pages/where-you-stand";
import EvidenceVault from "@/pages/evidence";
import EvidenceDetail from "@/pages/evidence-detail";
import CriteriaExhibit from "@/pages/criteria";
import CriterionDetail from "@/pages/criterion-detail";
import EliteBlueprint from "@/pages/blueprint";
import Courses from "@/pages/courses";
import CourseDetail from "@/pages/course-detail";
import ProfilePage from "@/pages/profile";

import { useRef } from "react";
import { DisclaimerProvider, useDisclaimer } from "@/contexts/DisclaimerContext";
import { ReconsentModal } from "@/components/disclaimers/ReconsentModal";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/how-it-works" component={HowItWorks} />
      <Route path="/products" component={Products} />

      <Route path="/dashboard" component={Dashboard} />
      <Route path="/where-you-stand" component={WhereYouStand} />
      <Route path="/evidence" component={EvidenceVault} />
      <Route path="/evidence/:id" component={EvidenceDetail} />
      <Route path="/criteria" component={CriteriaExhibit} />
      <Route path="/criteria/:id" component={CriterionDetail} />
      <Route path="/blueprint" component={EliteBlueprint} />
      <Route path="/courses" component={Courses} />
      <Route path="/courses/:id" component={CourseDetail} />
      <Route path="/profile" component={ProfilePage} />

      <Route component={NotFound} />
    </Switch>
  );
}

function AppInner() {
  const { setRequiresReconsent } = useDisclaimer();

  const queryClientRef = useRef<QueryClient | null>(null);
  if (!queryClientRef.current) {
    queryClientRef.current = new QueryClient({
      queryCache: new QueryCache({
        onError(error: unknown) {
          const e = error as Record<string, unknown>;
          if (
            typeof e === "object" &&
            e !== null &&
            e["status"] === 403 &&
            typeof e["data"] === "object" &&
            e["data"] !== null &&
            (e["data"] as Record<string, unknown>)["requiresReconsent"] === true
          ) {
            setRequiresReconsent(true);
          }
        },
      }),
      defaultOptions: {
        queries: { retry: false, refetchOnWindowFocus: false },
      },
    });
  }

  return (
    <QueryClientProvider client={queryClientRef.current}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
        <ReconsentModal />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

function App() {
  return (
    <DisclaimerProvider>
      <AppInner />
    </DisclaimerProvider>
  );
}

export default App;
