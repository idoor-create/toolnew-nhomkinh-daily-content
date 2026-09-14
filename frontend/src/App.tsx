import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth";
import { Layout } from "./components/Layout";
import { CalendarPage } from "./pages/CalendarPage";
import { CustomersPage } from "./pages/CustomersPage";
import { LoginPage } from "./pages/LoginPage";
import { PrivacyPolicyPage } from "./pages/PrivacyPolicyPage";
import { ContentLabPage } from "./pages/ContentLabPage";
import { RequireAuth } from "./RequireAuth";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/privacy" element={<PrivacyPolicyPage />} />
          <Route element={<RequireAuth />}>
            <Route element={<Layout />}>
              <Route path="/" element={<CalendarPage />} />
              <Route path="/channels" element={<CustomersPage />} />
              <Route path="/customers" element={<CustomersPage />} />
              <Route path="/content-lab" element={<ContentLabPage />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
