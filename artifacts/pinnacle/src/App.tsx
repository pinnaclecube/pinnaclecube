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
import { ProductProtectedRoute } from "@/components/auth/ProductProtectedRoute";
import { ActiveClientRoute } from "@/components/auth/ActiveClientRoute";
import NotFound from "@/pages/not-found";

import Home from "@/pages/Home";
import HowItWorks from "@/pages/how-it-works";
import Products from "@/pages/products";
import ClientLogin from "@/pages/ClientLogin";
import ClientRegister from "@/pages/ClientRegister";
import TermsOfService from "@/pages/TermsOfService";
import PrivacyPolicy from "@/pages/PrivacyPolicy";
import Disclaimer from "@/pages/Disclaimer";
import ExcellenceLabMarketing from "@/pages/ExcellenceLabMarketing";
import EvidenceVaultMarketing from "@/pages/EvidenceVaultMarketing";
import EliteBlueprintMarketing from "@/pages/EliteBlueprintMarketing";
import EliteBlueprintApply from "@/pages/EliteBlueprintApply";
import EliteBlueprintSubmitted from "@/pages/EliteBlueprintSubmitted";
import Quiz from "@/pages/Quiz";
import Resources from "@/pages/Resources";
import ArticleDetail from "@/pages/ArticleDetail";
import InstantProfileInsightStart from "@/pages/InstantProfileInsightStart";
import InstantProfileInsightResults from "@/pages/InstantProfileInsightResults";
import BoothCapture from "@/pages/BoothCapture";
import SetPassword from "@/pages/SetPassword";
import PaymentSuccess from "@/pages/PaymentSuccess";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";

import Dashboard from "@/pages/dashboard";
import ChoosePlan from "@/pages/ChoosePlan";
import WhereYouStand from "@/pages/where-you-stand";
import EvidenceVault from "@/pages/evidence";
import EvidenceDetail from "@/pages/evidence-detail";
import CriteriaExhibit from "@/pages/criteria";
import CriterionDetail from "@/pages/criterion-detail";
import EliteBlueprint from "@/pages/blueprint";
import Courses from "@/pages/courses";
import CourseDetail from "@/pages/course-detail";
import ProfilePage from "@/pages/profile";
import MyFiles from "@/pages/my-files";
import ReferenceLetters from "@/pages/reference-letters";
import ReadinessIntake from "@/pages/ReadinessIntake";
import Tasks from "@/pages/tasks";

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
import InternalBoothEvents from "@/pages/internal/InternalBoothEvents";
import ReadinessDashboard from "@/pages/internal/ReadinessDashboard";

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
      <Route path="/resources" component={Resources} />
      <Route path="/resources/:id" component={ArticleDetail} />
      <Route path="/instant-profile-insight/start" component={InstantProfileInsightStart} />
      <Route path="/instant-profile-insight/results" component={InstantProfileInsightResults} />
      <Route path="/booth" component={BoothCapture} />
      <Route path="/login" component={ClientLogin} />
      <Route path="/register" component={ClientRegister} />
      <Route path="/terms" component={TermsOfService} />
      <Route path="/privacy-policy" component={PrivacyPolicy} />
      <Route path="/disclaimer" component={Disclaimer} />
      <Route path="/payment-success" component={PaymentSuccess} />
      <Route path="/set-password" component={SetPassword} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/reset-password" component={ResetPassword} />

      {/* Checkout routes */}
      <Route path="/excellence-lab/checkout" component={ExcellenceLabCheckout} />
      <Route path="/excellence-lab/success" component={ExcellenceLabSuccess} />
      <Route path="/excellence-lab/cancel" component={ExcellenceLabCancel} />
      <Route path="/evidence-vault/checkout" component={EvidenceVaultCheckout} />
      <Route path="/evidence-vault/success" component={EvidenceVaultSuccess} />
      <Route path="/evidence-vault/cancel" component={EvidenceVaultCancel} />

      {/* Protected client routes — free users land here to choose a plan */}
      <Route path="/choose-plan">
        <ProtectedRoute><ChoosePlan /></ProtectedRoute>
      </Route>

      {/* Protected client routes — require at least one paid product */}
      <Route path="/dashboard">
        <ProtectedRoute>
          <ActiveClientRoute><Dashboard /></ActiveClientRoute>
        </ProtectedRoute>
      </Route>
      <Route path="/dashboard/readiness-intake">
        <ProtectedRoute>
          <ActiveClientRoute><ReadinessIntake /></ActiveClientRoute>
        </ProtectedRoute>
      </Route>
      <Route path="/where-you-stand">
        <ProtectedRoute>
          <ActiveClientRoute><WhereYouStand /></ActiveClientRoute>
        </ProtectedRoute>
      </Route>
      <Route path="/evidence">
        <ProtectedRoute>
          <ProductProtectedRoute product="evidence_vault" redirectTo="/evidence-vault/checkout">
            <EvidenceVault />
          </ProductProtectedRoute>
        </ProtectedRoute>
      </Route>
      <Route path="/evidence/:id">
        {() => (
          <ProtectedRoute>
            <ProductProtectedRoute product="evidence_vault" redirectTo="/evidence-vault/checkout">
              <EvidenceDetail />
            </ProductProtectedRoute>
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/criteria">
        <ProtectedRoute>
          <ActiveClientRoute><CriteriaExhibit /></ActiveClientRoute>
        </ProtectedRoute>
      </Route>
      <Route path="/criteria/:id">
        {() => (
          <ProtectedRoute>
            <ActiveClientRoute><CriterionDetail /></ActiveClientRoute>
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/blueprint">
        <ProtectedRoute>
          <ProductProtectedRoute product="elite_blueprint" redirectTo="/elite-blueprint">
            <EliteBlueprint />
          </ProductProtectedRoute>
        </ProtectedRoute>
      </Route>
      <Route path="/courses">
        <ProtectedRoute>
          <ProductProtectedRoute product="excellence_lab" redirectTo="/excellence-lab/checkout">
            <Courses />
          </ProductProtectedRoute>
        </ProtectedRoute>
      </Route>
      <Route path="/courses/:id">
        {() => (
          <ProtectedRoute>
            <ProductProtectedRoute product="excellence_lab" redirectTo="/excellence-lab/checkout">
              <CourseDetail />
            </ProductProtectedRoute>
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/profile">
        <ProtectedRoute><ProfilePage /></ProtectedRoute>
      </Route>
      <Route path="/my-files">
        <ProtectedRoute><MyFiles /></ProtectedRoute>
      </Route>
      <Route path="/reference-letters">
        <ProtectedRoute><ReferenceLetters /></ProtectedRoute>
      </Route>
      <Route path="/tasks">
        <ProtectedRoute>
          <ActiveClientRoute><Tasks /></ActiveClientRoute>
        </ProtectedRoute>
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
      <Route path="/internal/booth-events">
        <StaffProtectedRoute><InternalBoothEvents /></StaffProtectedRoute>
      </Route>
      <Route path="/internal/readiness">
        <StaffProtectedRoute><ReadinessDashboard /></StaffProtectedRoute>
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
