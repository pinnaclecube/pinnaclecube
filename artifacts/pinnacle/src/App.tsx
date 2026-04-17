import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

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

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
