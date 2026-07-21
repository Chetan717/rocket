import Home from "./Pages/Home";
import { SecureLogin as Login } from "./Auth/SecureLogin";
import ProtectedRoute from "./Auth/ProtectedR";
import { Routes, Route, Navigate } from "react-router";
import Layout from "./Layout";
import CompaniesHome from "./Pages/companies/CompaniesHome";
import AddCompanies from "./Pages/companies/Forms/AddCompanies";
import EditCompanies from "./Pages/companies/Forms/EditCompanies";
import AddTemplate from "./Pages/Templates/Forms/AddTemplate";
import EditTemplate from "./Pages/Templates/Forms/EditTemplate";
import CopyRankPromotion from "./Pages/Templates/Forms/CopyRankPromotion";
import TemplateHome from "./Pages/Templates/TemplateHome";
import GraphiHome from "./Pages/Graphics/GraphiHome";
import AddGraphics from "./Pages/Graphics/Form/AddGraphics";
import EditGraphics from "./Pages/Graphics/Form/EditGraphics";
import MainTeam from "./Pages/Mteam/MainTeam";
import Removebg from "./Pages/Removebg/Removebg";
import UserDashboard from "./Pages/UserDashboard/UserDashboard";
import AdminManagement from "./Pages/AdminManagement/AdminManagement";
import Leads from "./Pages/Leads/Leads";
import TemplateData from "./Pages/Templates/TemplateData";
import SecuritySessions from "./Pages/SecuritySessions";

function App() {
  return (
    <Routes>
      {/* ── Protected routes (with Sidebar + Header) ── */}
      <Route path="/" element={<ProtectedRoute><Layout><Home /></Layout></ProtectedRoute>} />
      <Route path="/dashboard" element={<ProtectedRoute><Layout><TemplateHome /></Layout></ProtectedRoute>} />

      {/* Companies */}
      <Route path="/companies"          element={<ProtectedRoute><Layout><CompaniesHome /></Layout></ProtectedRoute>} />
      <Route path="/companies/add"      element={<ProtectedRoute><Layout><AddCompanies /></Layout></ProtectedRoute>} />
      <Route path="/companies/edit/:id" element={<ProtectedRoute><Layout><EditCompanies /></Layout></ProtectedRoute>} />

      {/* Templates */}
      <Route path="/templates"          element={<ProtectedRoute><Layout><TemplateHome /></Layout></ProtectedRoute>} />
      <Route path="/templates/add"                    element={<ProtectedRoute><Layout><AddTemplate /></Layout></ProtectedRoute>} />
      <Route path="/templates/edit/:id"              element={<ProtectedRoute><Layout><EditTemplate /></Layout></ProtectedRoute>} />
      <Route path="/templates/copy-rank-promotion"   element={<ProtectedRoute><Layout><CopyRankPromotion /></Layout></ProtectedRoute>} />

      {/* Graphics */}
      <Route path="/graphics"           element={<ProtectedRoute><Layout><GraphiHome /></Layout></ProtectedRoute>} />
      <Route path="/graphics/add"       element={<ProtectedRoute><Layout><AddGraphics /></Layout></ProtectedRoute>} />
      <Route path="/graphics/edit/:id"  element={<ProtectedRoute><Layout><EditGraphics /></Layout></ProtectedRoute>} />

      {/* Marketing */}
      <Route path="/marketing"          element={<ProtectedRoute><Layout><MainTeam /></Layout></ProtectedRoute>} />

      {/* Remove BG */}
      <Route path="/removebg"           element={<ProtectedRoute><Layout><Removebg /></Layout></ProtectedRoute>} />

      {/* User Subscription Dashboard */}
      <Route path="/userdashboard"      element={<ProtectedRoute><Layout><UserDashboard /></Layout></ProtectedRoute>} />

      {/* Leads */}
      <Route path="/leads"              element={<ProtectedRoute><Layout><Leads /></Layout></ProtectedRoute>} />

      {/* Template Data Report */}
      <Route path="/templatedata"       element={<ProtectedRoute><Layout><TemplateData /></Layout></ProtectedRoute>} />

      {/* Admin Management */}
      <Route path="/adminmanagement"    element={<ProtectedRoute><Layout>
        <AdminManagement /></Layout></ProtectedRoute>} />
      <Route path="/security" element={<ProtectedRoute><Layout><SecuritySessions /></Layout></ProtectedRoute>} />

      {/* ── Auth routes ── */}
      <Route path="/login"    element={<Login />} />
      <Route path="/signup" element={<Navigate to="/login" replace />} />
      <Route path="/forgetpin" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default App;
