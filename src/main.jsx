import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { BrowserRouter, Routes, Route } from "react-router";
import { GeneralContext } from "./Context/GeneralContext.jsx";
import { Toast } from '@heroui/react';
import { AdminAuthProvider } from "./Auth/AdminAuthContext.jsx";

if (import.meta.env.PROD) console.error = () => {};

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <GeneralContext>
      <Toast.Provider  />
      <BrowserRouter>
        <AdminAuthProvider><Routes><Route path="/*" element={<App />} /></Routes></AdminAuthProvider>
      </BrowserRouter>
    </GeneralContext>
  </StrictMode>,
);
