import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider, QueryCache } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useRef } from "react";
import { DisclaimerProvider, useDisclaimer } from "@/contexts/DisclaimerContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { ReconsentModal } from "@/components/disclaimers/ReconsentModal";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { StaffProtectedRoute } from "@/components/auth/StaffProtectedRoute";
import NotFound from "@/pages/not-found";

import Home from "@/pages/Home";
import HowItWorks from "@/pages/how-it-works";
import Products from "@/pages/products";
import ClientLogin from "@/pages/ClientLogin";
import ClientRegister from "@/pages/ClientRegister";
import ExcellenceLabMarketing from "@/pages/ExcellenceLabMarketing";
import EvidenceVaultMarketing from "@/pages/EvidenceVaultMarketing";
import EliteBlueprintMarketing from "@/pages/EliteBlueprintMarketing";
import EliteBlueprintApply from "@/pages/EliteBlueprintApply";
import EliteBlueprintSubmitted from "@/pages/EliteBlueprintSubmitted";
import Quiz from "@/pages/Quiz";
import InstantProfileInsightStart from "@/pages/InstantProfileInsightStart";
import InstantProfileInsightResults from "@/pages/InstantProfileInsightResults";

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
import ReadinessIntake from "@/pages/ReadinessIntake";

import ExcellenceLabCheckout from "@/pages/checkout/ExcellenceLabCheckout";
import ExcellenceLabSuccess from "@/pages/checkout/ExcellenceLabSuccess";
import ExcellenceLabCancel from "@/pages/checkout/ExcellenceLabCancel";
import EvidenceVaultCheckout from "@/pages/checkout/EvidenceVaultCheckout";
import EvidenceVaultSuccess from "@/pages/checkout/EvidenceVaultSuccess";
import EvidenceVaultCancel from "@/pages/checkout/EvidenceVaultCancel";

import InternalCases from "@/pages/internal/InternalCases";
import InternalCaseDetail from "@/pages/internal/InternalCaseDetail";
import InternalCaseActivityLog from "@/pages/internal/InternalCaseActivityLog";
import InternalEvidenceDetail from "@/pages/internal/InternalEvidenceDetail";
import InternalProspects from "@/pages/internal/InternalProspects";
import InternalProspectDetail from "@/pages/internal/InternalProspectDetail";
import InternalEliteBlueprintApplications from "@/pages/internal/InternalEliteBlueprintApplications";
import InternalEliteBlueprintApplicationDetail from "@/pages/internal/InternalEliteBlueprintApplicationDetail";

function Router() {
  return (
    <Switch>
      {/* Public routes */}
      <Route path="/" component={Home} />
      <Route path="/how-it-works" component={HowItWorks} />
      <Route path="/products" component={Products} />
      <Route path="/excellence-lab" component={ExcellenceLabMarketing} />
      <Route path="/evidence-vault" component={EvidenceVaultMarketing} />
      <Route path="/elite-blueprint" component={EliteBlueprintMarketing} />
      <Route path="/elite-blueprint/apply" component={EliteBlueprintApply} />
      <Route path="/elite-blueprint/submitted" component={EliteBlueprintSubmitted} />
      <Route path="/quiz" component={Quiz} />
      <Route path="/instant-profile-insight/start" component={InstantProfileInsightStart} />
      <Route path="/instant-profile-insight/results" component={InstantProfileInsightResults} />
      <Route path="/login" component={ClientLogin} />
      <Route path="/register" component={ClientRegister} />

      {/* Checkout routes */}
      <Route path="/excellence-lab/checkout" component={ExcellenceLabCheckout} />
      <Route path="/excellence-lab/success" component={ExcellenceLabSuccess} />
      <Route path="/excellence-lab/cancel" component={ExcellenceLabCancel} />
      <Route path="/evidence-vault/checkout" component={EvidenceVaultCheckout} />
      <Route path="/evidence-vault/success" component={EvidenceVaultSuccess} />
      <Route path="/evidence-vault/cancel" component={EvidenceVaultCancel} />

      {/* Protected client routes */}
      <Route path="/dashboard">
        <ProtectedRoute><Dashboard /></ProtectedRoute>
      </Route>
      <Route path="/dashboard/readiness-intake">
        <ProtectedRoute><ReadinessIntake /></ProtectedRoute>
      </Route>
      <Route path="/where-you-stand">
        <ProtectedRoute><WhereYouStand /></ProtectedRoute>
      </Route>
      <Route path="/evidence">
        <ProtectedRoute><EvidenceVault /></ProtectedRoute>
      </Route>
      <Route path="/evidence/:id">
        {(params) => <ProtectedRoute><EvidenceDetail /></ProtectedRoute>}
      </Route>
      <Route path="/criteria">
        <ProtectedRoute><CriteriaExhibit /></ProtectedRoute>
      </Route>
      <Route path="/criteria/:id">
        {(params) => <ProtectedRoute><CriterionDetail /></ProtectedRoute>}
      </Route>
      <Route path="/blueprint">
        <ProtectedRoute><EliteBlueprint /></ProtectedRoute>
      </Route>
      <Route path="/courses">
        <ProtectedRoute><Courses /></ProtectedRoute>
      </Route>
      <Route path="/courses/:id">
        {(params) => <ProtectedRoute><CourseDetail /></ProtectedRoute>}
      </Route>
      <Route path="/profile">
        <ProtectedRoute><ProfilePage /></ProtectedRoute>
      </Route>

      {/* Internal staff routes */}
      <Route path="/internal/cases">
        <StaffProtectedRoute><InternalCases /></StaffProtectedRoute>
      </Route>
      <Route path="/internal/case/:user_id">
        {(params) => <StaffProtectedRoute><InternalCaseDetail /></StaffProtectedRoute>}
      </Route>
      <Route path="/internal/case/:user_id/activity-log">
        {(params) => <StaffProtectedRoute><InternalCaseActivityLog /></StaffProtectedRoute>}
      </Route>
      <Route path="/internal/case/:user_id/evidence/:evidence_id">
        {(params) => <StaffProtectedRoute><InternalEvidenceDetail /></StaffProtectedRoute>}
      </Route>
      <Route path="/internal/prospects">
        <StaffProtectedRoute><InternalProspects /></StaffProtectedRoute>
      </Route>
      <Route path="/internal/prospect/:id">
        {(params) => <StaffProtectedRoute><InternalProspectDetail /></StaffProtectedRoute>}
      </Route>
      <Route path="/internal/elite-blueprint-applications">
        <StaffProtectedRoute><InternalEliteBlueprintApplications /></StaffProtectedRoute>
      </Route>
      <Route path="/internal/elite-blueprint-applications/:id">
        {(params) => <StaffProtectedRoute><InternalEliteBlueprintApplicationDetail /></StaffProtectedRoute>}
      </Route>

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
          <AuthProvider>
            <Router />
          </AuthProvider>
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
