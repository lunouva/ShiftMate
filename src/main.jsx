import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import App from './App.jsx'
import HomePage from './pages/HomePage.jsx'
import SignupPage from './pages/SignupPage.jsx'
import PricingPage from './pages/PricingPage.jsx'
import BillingSuccessPage from './pages/BillingSuccessPage.jsx'
import BillingCancelPage from './pages/BillingCancelPage.jsx'
import './index.css'
import { getSubdomainInfo } from './lib/subdomain.js'

const { isRootDomain, workspaceSlug } = getSubdomainInfo()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      {isRootDomain ? (
        /* ── Public / marketing routes (root domain) ── */
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/pricing" element={<PricingPage />} />
          <Route path="/billing/success" element={<BillingSuccessPage />} />
          <Route path="/billing/cancel" element={<BillingCancelPage />} />
          {/* Invite accept also works from the root domain */}
          <Route path="/invite/accept" element={<App workspaceSlug={null} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      ) : (
        /* ── Workspace app routes (workspace subdomain) ── */
        <Routes>
          <Route path="/billing/success" element={<BillingSuccessPage />} />
          <Route path="/billing/cancel" element={<BillingCancelPage />} />
          <Route path="*" element={<App workspaceSlug={workspaceSlug} />} />
        </Routes>
      )}
    </BrowserRouter>
  </React.StrictMode>,
)
