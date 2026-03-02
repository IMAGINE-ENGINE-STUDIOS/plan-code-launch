import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { WizardProvider } from "@/contexts/WizardContext";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import PageNavigator from "@/components/PageNavigator";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import NewProject from "./pages/NewProject";
import PlanReview from "./pages/PlanReview";
import ImportProject from "./pages/ImportProject";
import ProjectWorkspace from "./pages/workspace/ProjectWorkspace";
import EditMode from "./pages/workspace/EditMode";
import DevMode from "./pages/workspace/DevMode";
import AnalysisMode from "./pages/workspace/AnalysisMode";
import PublishPage from "./pages/workspace/PublishPage";
import SettingsPage from "./pages/workspace/SettingsPage";
import VersionHistory from "./pages/workspace/VersionHistory";
import ChatMode from "./pages/workspace/ChatMode";
import CostsPage from "./pages/CostsPage";
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <WizardProvider>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                <Route path="/new-project" element={<ProtectedRoute><NewProject /></ProtectedRoute>} />
                <Route path="/project/new/plan" element={<ProtectedRoute><PlanReview /></ProtectedRoute>} />
                <Route path="/import" element={<ProtectedRoute><ImportProject /></ProtectedRoute>} />
                <Route path="/costs" element={<ProtectedRoute><CostsPage /></ProtectedRoute>} />
                <Route path="/project/:id" element={<ProtectedRoute><ProjectWorkspace /></ProtectedRoute>}>
                  <Route index element={<Navigate to="dev" replace />} />
                  <Route path="edit" element={<EditMode />} />
                  <Route path="chat" element={<ChatMode />} />
                  <Route path="dev" element={<DevMode />} />
                  <Route path="analysis" element={<AnalysisMode />} />
                  <Route path="publish" element={<PublishPage />} />
                  <Route path="settings" element={<SettingsPage />} />
                  <Route path="versions" element={<VersionHistory />} />
                  <Route path="*" element={<Navigate to="edit" replace />} />
                </Route>
                <Route path="*" element={<NotFound />} />
              </Routes>
              <PageNavigator />
            </WizardProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
