import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/base.css'
import { usePageMeta, usePath } from './router'
import { Layout } from './site/Layout'

import Home from './pages/Home.jsx'
import ProgramsPage from './pages/ProgramsPage.jsx'
import ProgramPage from './pages/ProgramPage.jsx'
import MethodPage from './pages/MethodPage.jsx'
import VisitPage from './pages/VisitPage.jsx'
import NotFound from './NotFound.jsx'

// The pages are light and load with the app; only the 3D scene and the staff dashboard are split off.
const Admin = lazy(() => import('./admin/Admin.jsx'))

function page(path) {
  if (path === '/') return <Home />
  if (path === '/programs') return <ProgramsPage />
  const program = path.match(/^\/programs\/([a-z-]+)$/)
  if (program) return <ProgramPage id={program[1]} />
  if (path === '/method') return <MethodPage />
  if (path === '/visit') return <VisitPage />
  return <NotFound />
}

function App() {
  const path = usePath()
  usePageMeta(path)
  if (path === '/admin') return <Admin />
  return (
    <Layout path={path}>
      <Suspense fallback={<div className="boot" aria-busy="true" />}>{page(path)}</Suspense>
    </Layout>
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Suspense fallback={<div className="boot" aria-busy="true" />}>
      <App />
    </Suspense>
  </StrictMode>,
)
