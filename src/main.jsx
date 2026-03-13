import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import App from './App.jsx'
import HomePage from './pages/HomePage.jsx'
import MarketingContentPage from './pages/MarketingContentPage.jsx'
import SignupPage from './pages/SignupPage.jsx'
import PricingPage from './pages/PricingPage.jsx'
import BillingSuccessPage from './pages/BillingSuccessPage.jsx'
import BillingCancelPage from './pages/BillingCancelPage.jsx'
import './index.css'
import { marketingPages } from './content/marketingPages.js'
import { getSubdomainInfo } from './lib/subdomain.js'

const { isRootDomain, workspaceSlug } = getSubdomainInfo()
const rootWorkspaceSlug = new URLSearchParams(window.location.search).get('org')

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      {isRootDomain ? (
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/app/*" element={<App workspaceSlug={rootWorkspaceSlug} />} />
          <Route path="/login" element={<Navigate to="/app" replace />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/pricing" element={<PricingPage />} />
          <Route path="/billing/success" element={<BillingSuccessPage />} />
          <Route path="/billing/cancel" element={<BillingCancelPage />} />
          <Route path="/invite/accept" element={<App workspaceSlug={rootWorkspaceSlug} />} />
          {marketingPages.map((page) => (
            <Route key={page.path} path={page.path} element={<MarketingContentPage page={page} />} />
          ))}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      ) : (
        <Routes>
          <Route path="/billing/success" element={<BillingSuccessPage />} />
          <Route path="/billing/cancel" element={<BillingCancelPage />} />
          <Route path="*" element={<App workspaceSlug={workspaceSlug} />} />
        </Routes>
      )}
    </BrowserRouter>
  </React.StrictMode>,
)
