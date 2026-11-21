import { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { MainLayout } from './components/layout';
import { NetworkStatusBanner } from './components/feedback/NetworkStatusBanner';
import { useAuth } from './contexts/AuthContext';
import { env } from './config/env';
import { lazyWithRetry as lazy } from './utils/lazyWithRetry';

const ServiceGridPage       = lazy(() => import('./pages/services/ServiceGridPage').then(m => ({ default: m.ServiceGridPage })));
const OverviewPage          = lazy(() => import('./pages/overview/OverviewPage').then(m => ({ default: m.OverviewPage })));
const ProjectDetailPage     = lazy(() => import('./pages/services/ProjectDetailPage').then(m => ({ default: m.ProjectDetailPage })));
const HealthCheckDetailPage = lazy(() => import('./pages/healthcheck/HealthCheckDetailPage').then(m => ({ default: m.HealthCheckDetailPage })));
const AlertsPage            = lazy(() => import('./pages/alerts/AlertsPage').then(m => ({ default: m.AlertsPage })));
const SettingsPage          = lazy(() => import('./pages/settings/SettingsPage').then(m => ({ default: m.SettingsPage })));
const NotFoundPage          = lazy(() => import('./pages/NotFoundPage').then(m => ({ default: m.NotFoundPage })));
const LoginPage             = lazy(() => import('./pages/auth/LoginPage').then(m => ({ default: m.LoginPage })));
const ChannelFormPage       = lazy(() => import('./pages/alerts/ChannelFormPage').then(m => ({ default: m.ChannelFormPage })));
const LogsPage              = lazy(() => import('./pages/capabilities/LogsPage').then(m => ({ default: m.LogsPage })));
const MorePage              = lazy(() => import('./pages/capabilities/MorePage').then(m => ({ default: m.MorePage })));
const ProjectsPage          = lazy(() => import('./pages/projects/ProjectsPage').then(m => ({ default: m.ProjectsPage })));
const ProjectOverviewPage   = lazy(() => import('./pages/projects/ProjectOverviewPage').then(m => ({ default: m.ProjectOverviewPage })));
const ServersPage           = lazy(() => import('./pages/servers/ServersPage').then(m => ({ default: m.ServersPage })));
const ServerDetailPage      = lazy(() => import('./pages/servers/ServerDetailPage').then(m => ({ default: m.ServerDetailPage })));
const ServerFormPage        = lazy(() => import('./pages/servers/ServerFormPage').then(m => ({ default: m.ServerFormPage })));
const LegacyTargetRedirect  = lazy(() => import('./pages/servers/LegacyTargetRedirect').then(m => ({ default: m.LegacyTargetRedirect })));
const LegacyServerAppRedirect = lazy(() => import('./pages/servers/LegacyTargetRedirect').then(m => ({ default: m.LegacyServerAppRedirect })));
const ServerAppPage = lazy(() => import('./pages/servers/ServerAppPage').then(m => ({ default: m.ServerAppPage })));
const ServerMonitorPage = lazy(() => import('./pages/servers/ServerMonitorPage').then(m => ({ default: m.ServerMonitorPage })));
const LegacyServerTabRedirect = lazy(() => import('./pages/servers/LegacyTargetRedirect').then(m => ({ default: m.LegacyServerTabRedirect })));
const LegacyServerMonitorRedirect = lazy(() => import('./pages/servers/LegacyTargetRedirect').then(m => ({ default: m.LegacyServerMonitorRedirect })));

function PageLoader() {
  return (
    <div className="flex-1 p-4 sm:p-6 md:p-8 space-y-heading animate-pulse">
      <div className="h-8 bg-ui-active rounded-lg w-48" />
      <div className="h-4 bg-ui-hover rounded w-72" />
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mt-6">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-40 bg-ui-hover rounded-xl" />
        ))}
      </div>
    </div>
  );
}

function ProtectedRoute() {
  const { isAuthenticated } = useAuth();
  // 데모 모드에서는 인증 없이 통과
  if (env.isDemoMode) return <Outlet />;
  return isAuthenticated
    ? <Outlet />
    : <Navigate to="/login" replace state={{ from: location.pathname }} />;
}

function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <NetworkStatusBanner />
      <div className="bg-bg-main text-text-base transition-colors duration-200">
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* 데모 모드에서는 /login 접근 시 홈으로 리다이렉트 */}
            <Route path="/login" element={env.isDemoMode ? <Navigate to="/" replace /> : <LoginPage />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<MainLayout />}>
                <Route index element={<OverviewPage />} />
                <Route path="/environments" element={<ServiceGridPage />} />
                <Route path="/servers" element={<ServersPage />} />
                <Route path="/servers/new" element={<ServerFormPage />} />
                <Route path="/servers/:serverId" element={<ServerDetailPage />} />
                <Route path="/servers/:serverId/:capability" element={<ServerDetailPage />} />
                {/* 인프라 리소스는 서버마다 하나라 대상 주소가 없다(옛 /servers/:s/infrastructure/:id). 쿼리를 두고 탭으로 보낸다. */}
                <Route path="/servers/:serverId/:capability/:targetId" element={<LegacyServerTabRedirect />} />
                {/* 앱과 업타임 모니터 하나의 페이지(대상 상세, 2026-11-21). 서버 탭 안의 옛 대상 주소는 쿼리를 옮겨 이리로 보낸다. */}
                <Route path="/servers/:serverId/apps/:appId" element={<ServerAppPage />} />
                <Route path="/servers/:serverId/monitors/:monitorId" element={<ServerMonitorPage />} />
                <Route path="/servers/:serverId/uptime/:monitorId" element={<LegacyServerMonitorRedirect />} />
                {(['logs', 'api', 'metrics'] as const).map((kind) => <Route key={kind} path={`/servers/:serverId/${kind}/:appId`} element={<LegacyServerAppRedirect kind={kind} />} />)}
                <Route path="/agents" element={<Navigate to="/environments" replace />} />
                {/* 옛 기능별 메뉴의 주소(설계 6.2). 목록은 서버 목록으로, 대상은 그 대상의 서버 화면으로 보낸다. */}
                {['/services', '/uptime', '/infrastructure', '/api', '/metrics'].map((path) => <Route key={path} path={path} element={<Navigate to="/servers" replace />} />)}
                <Route path="/uptime/:id" element={<LegacyTargetRedirect kind="uptime" />} />
                <Route path="/logs/:id" element={<LegacyTargetRedirect kind="logs" />} />
                <Route path="/api/:id" element={<LegacyTargetRedirect kind="api" />} />
                <Route path="/metrics/:id" element={<LegacyTargetRedirect kind="metrics" />} />
                <Route path="/infrastructure/:id" element={<LegacyTargetRedirect kind="infrastructure" />} />
                <Route path="/logs" element={<LogsPage />} />
                <Route path="/more" element={<MorePage />} />
                <Route path="/projects" element={<ProjectsPage />} />
                <Route path="/projects/:projectId" element={<ProjectOverviewPage />} />
                <Route path="/agents/:agentId" element={<ProjectDetailPage />} />
                <Route path="/agents/:agentId/:tab" element={<ProjectDetailPage />} />
                <Route path="/services/:agentId/:key" element={<HealthCheckDetailPage />} />
                <Route path="/alerts" element={<AlertsPage />} />
                <Route path="/alerts/channels/new" element={<ChannelFormPage />} />
                <Route path="/alerts/channels/:id/edit" element={<ChannelFormPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="*" element={<NotFoundPage />} />
              </Route>
            </Route>
          </Routes>
        </Suspense>
      </div>
    </BrowserRouter>
  );
}

export default App;
