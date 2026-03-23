import { Suspense, lazy } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { queryClient } from "@/lib/queryClient";
import { AuthProvider } from "@/hooks/useAuth";
import { AdvertiserAuthProvider } from "@/hooks/useAdvertiserAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AdvertiserRoute } from "@/components/AdvertiserRoute";
import { RoleRoute } from "@/components/RoleRoute";
import { Spinner } from "@/components/ui/Spinner";

// ── Layouts ────────────────────────────────────────────────────────

const PublicLayout = lazy(() => import("@/layouts/PublicLayout"));
const AuthLayout = lazy(() => import("@/layouts/AuthLayout"));
const AppLayout = lazy(() => import("@/layouts/AppLayout"));
const AdminLayout = lazy(() => import("@/layouts/AdminLayout"));
const ChannelAdminLayout = lazy(() => import("@/layouts/ChannelAdminLayout"));
const CreatorAdminLayout = lazy(() => import("@/layouts/CreatorAdminLayout"));

// ── Public pages ───────────────────────────────────────────────────

const HomePage = lazy(() => import("@/pages/HomePage"));
const ExplorePage = lazy(() => import("@/pages/ExplorePage"));
const ChannelPage = lazy(() => import("@/pages/ChannelPage"));
const VideoPage = lazy(() => import("@/pages/VideoPage"));
const PricingPage = lazy(() => import("@/pages/PricingPage"));

// ── Auth pages ─────────────────────────────────────────────────────

const LoginPage = lazy(() => import("@/pages/auth/LoginPage"));
const SignupPage = lazy(() => import("@/pages/auth/SignupPage"));
const ForgotPasswordPage = lazy(
  () => import("@/pages/auth/ForgotPasswordPage"),
);
const ResetPasswordPage = lazy(
  () => import("@/pages/auth/ResetPasswordPage"),
);
const VerifyEmailPage = lazy(() => import("@/pages/auth/VerifyEmailPage"));

// ── Authenticated app pages ────────────────────────────────────────

const WatchPage = lazy(() => import("@/pages/app/WatchPage"));
const MyLibraryPage = lazy(() => import("@/pages/app/MyLibraryPage"));
const AccountPage = lazy(() => import("@/pages/app/AccountPage"));
const SubscriptionsPage = lazy(
  () => import("@/pages/app/SubscriptionsPage"),
);
const PurchasesPage = lazy(() => import("@/pages/app/PurchasesPage"));
const WatchHistoryPage = lazy(() => import("@/pages/app/WatchHistoryPage"));
const DevicesPage = lazy(() => import("@/pages/app/DevicesPage"));
const CheckoutSuccessPage = lazy(
  () => import("@/pages/app/CheckoutSuccessPage"),
);

// ── Super-admin pages ──────────────────────────────────────────────

const AdminDashboard = lazy(() => import("@/pages/admin/DashboardPage"));
const AdminChannels = lazy(() => import("@/pages/admin/ChannelsPage"));
const AdminChannelEdit = lazy(() => import("@/pages/admin/ChannelEditPage"));
const AdminCreators = lazy(() => import("@/pages/admin/CreatorsPage"));
const AdminVideos = lazy(() => import("@/pages/admin/VideosPage"));
const AdminVideoEdit = lazy(() => import("@/pages/admin/VideoEditPage"));
const AdminPlans = lazy(() => import("@/pages/admin/PlansPage"));
const AdminBundles = lazy(() => import("@/pages/admin/BundlesPage"));
const AdminContentRows = lazy(() => import("@/pages/admin/ContentRowsPage"));
const AdminHeroes = lazy(() => import("@/pages/admin/HeroesPage"));
const AdminHomepageBuilder = lazy(() => import("@/pages/admin/HomepageBuilderPage"));
const AdminChannelPageBuilder = lazy(() => import("@/pages/admin/ChannelPageBuilderPage"));
const AdminCategories = lazy(() => import("@/pages/admin/CategoriesPage"));
const AdminSales = lazy(() => import("@/pages/admin/SalesPage"));

// ── Channel-admin pages ────────────────────────────────────────────

const ChannelAdminDashboard = lazy(
  () => import("@/pages/channel-admin/DashboardPage"),
);
const ChannelAdminVideos = lazy(
  () => import("@/pages/channel-admin/VideosPage"),
);
const ChannelAdminCreators = lazy(
  () => import("@/pages/channel-admin/CreatorsPage"),
);
const ChannelAdminContent = lazy(
  () => import("@/pages/channel-admin/ContentPage"),
);
const ChannelAdminSales = lazy(
  () => import("@/pages/channel-admin/SalesPage"),
);

// ── Creator-admin pages ────────────────────────────────────────────

const CreatorAdminDashboard = lazy(
  () => import("@/pages/creator-admin/DashboardPage"),
);
const CreatorAdminVideos = lazy(
  () => import("@/pages/creator-admin/VideosPage"),
);
const CreatorAdminVideoEdit = lazy(
  () => import("@/pages/creator-admin/VideoEditPage"),
);
const CreatorAdminCategories = lazy(
  () => import("@/pages/creator-admin/CategoriesPage"),
);

// ── Advertiser pages ────────────────────────────────────────────────

const AdvertiseLandingPage = lazy(
  () => import("@/pages/advertise/LandingPage"),
);
const AdvertiserLoginPage = lazy(
  () => import("@/pages/advertise/LoginPage"),
);
const AdvertiserSignupPage = lazy(
  () => import("@/pages/advertise/SignupPage"),
);
const AdvertiserDashboard = lazy(
  () => import("@/pages/advertise/DashboardPage"),
);
const CampaignCreatePage = lazy(
  () => import("@/pages/advertise/CampaignCreatePage"),
);
const CampaignDetailPage = lazy(
  () => import("@/pages/advertise/CampaignDetailPage"),
);
const AdvertiserLayout = lazy(() => import("@/layouts/AdvertiserLayout"));

// ── Admin ad campaigns ──────────────────────────────────────────────

const AdminAdCampaigns = lazy(
  () => import("@/pages/admin/AdCampaignsPage"),
);
const AdminAdvertisers = lazy(() => import("@/pages/admin/AdvertisersPage"));

// ── Not found ──────────────────────────────────────────────────────

const NotFoundPage = lazy(() => import("@/pages/NotFoundPage"));

function PageLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Spinner size="lg" />
    </div>
  );
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <AdvertiserAuthProvider>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              {/* ── Public ──────────────────────────────── */}
              <Route element={<PublicLayout />}>
                <Route index element={<HomePage />} />
                <Route path="explore" element={<ExplorePage />} />
                <Route path="channels/:slug" element={<ChannelPage />} />
                <Route path="videos/:slug" element={<VideoPage />} />
                <Route path="pricing/:channelSlug" element={<PricingPage />} />
              </Route>

              {/* ── Auth ────────────────────────────────── */}
              <Route element={<AuthLayout />}>
                <Route path="login" element={<LoginPage />} />
                <Route path="signup" element={<SignupPage />} />
                <Route
                  path="forgot-password"
                  element={<ForgotPasswordPage />}
                />
                <Route
                  path="reset-password"
                  element={<ResetPasswordPage />}
                />
                <Route path="verify-email" element={<VerifyEmailPage />} />
              </Route>

              {/* ── Watch page (accessible for free-with-ads) ── */}
              <Route path="watch/:slug" element={<WatchPage />} />

              {/* ── Authenticated app ───────────────────── */}
              <Route element={<ProtectedRoute />}>
                <Route element={<AppLayout />}>
                  <Route path="library" element={<MyLibraryPage />} />
                  <Route path="account" element={<AccountPage />} />
                  <Route
                    path="account/subscriptions"
                    element={<SubscriptionsPage />}
                  />
                  <Route
                    path="account/purchases"
                    element={<PurchasesPage />}
                  />
                  <Route
                    path="account/history"
                    element={<WatchHistoryPage />}
                  />
                  <Route path="account/devices" element={<DevicesPage />} />
                  <Route
                    path="checkout/success"
                    element={<CheckoutSuccessPage />}
                  />
                </Route>
              </Route>

              {/* ── Admin Panel (Super Admin + Channel Admin) */}
              <Route
                element={<RoleRoute role={["SUPER_ADMIN", "CHANNEL_ADMIN"]} />}
              >
                <Route path="admin" element={<AdminLayout />}>
                  <Route index element={<AdminDashboard />} />
                  <Route path="channels" element={<AdminChannels />} />
                  <Route
                    path="channels/:id"
                    element={<AdminChannelEdit />}
                  />
                  <Route path="creators" element={<AdminCreators />} />
                  <Route path="videos" element={<AdminVideos />} />
                  <Route path="videos/:id" element={<AdminVideoEdit />} />
                  <Route path="plans" element={<AdminPlans />} />
                  <Route path="bundles" element={<AdminBundles />} />
                  <Route
                    path="content-rows"
                    element={<AdminContentRows />}
                  />
                  <Route path="heroes" element={<AdminHeroes />} />
                  <Route
                    path="homepage-builder"
                    element={<AdminHomepageBuilder />}
                  />
                  <Route
                    path="channel-page-builder"
                    element={<AdminChannelPageBuilder />}
                  />
                  <Route
                    path="categories"
                    element={<AdminCategories />}
                  />
                  <Route path="sales" element={<AdminSales />} />
                  <Route
                    path="ad-campaigns"
                    element={<AdminAdCampaigns />}
                  />
                  <Route path="advertisers" element={<AdminAdvertisers />} />
                </Route>
              </Route>

              {/* ── Channel Admin ───────────────────────── */}
              <Route
                element={
                  <RoleRoute
                    role="CHANNEL_ADMIN"
                    channelParam="channelId"
                  />
                }
              >
                <Route
                  path="channel-admin/:channelId"
                  element={<ChannelAdminLayout />}
                >
                  <Route index element={<ChannelAdminDashboard />} />
                  <Route path="videos" element={<ChannelAdminVideos />} />
                  <Route
                    path="creators"
                    element={<ChannelAdminCreators />}
                  />
                  <Route path="content" element={<ChannelAdminContent />} />
                  <Route path="sales" element={<ChannelAdminSales />} />
                </Route>
              </Route>

              {/* ── Creator Admin ───────────────────────── */}
              <Route
                element={
                  <RoleRoute
                    role="CREATOR_ADMIN"
                    creatorParam="creatorId"
                  />
                }
              >
                <Route
                  path="creator-admin/:creatorId"
                  element={<CreatorAdminLayout />}
                >
                  <Route index element={<CreatorAdminDashboard />} />
                  <Route path="videos" element={<CreatorAdminVideos />} />
                  <Route
                    path="videos/:id"
                    element={<CreatorAdminVideoEdit />}
                  />
                  <Route path="categories" element={<CreatorAdminCategories />} />
                </Route>
              </Route>

              {/* ── Advertiser (public landing) ──────────── */}
              <Route element={<PublicLayout />}>
                <Route path="advertise" element={<AdvertiseLandingPage />} />
              </Route>

              {/* ── Advertiser auth ─────────────────────── */}
              <Route path="advertise/login" element={<AdvertiserLoginPage />} />
              <Route
                path="advertise/signup"
                element={<AdvertiserSignupPage />}
              />

              {/* ── Advertiser protected ────────────────── */}
              <Route element={<AdvertiserRoute />}>
                <Route element={<AdvertiserLayout />}>
                  <Route
                    path="advertise/dashboard"
                    element={<AdvertiserDashboard />}
                  />
                  <Route
                    path="advertise/campaigns/new"
                    element={<CampaignCreatePage />}
                  />
                  <Route
                    path="advertise/campaigns/:id"
                    element={<CampaignDetailPage />}
                  />
                </Route>
              </Route>

              {/* ── 404 ─────────────────────────────────── */}
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </Suspense>
          </AdvertiserAuthProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
