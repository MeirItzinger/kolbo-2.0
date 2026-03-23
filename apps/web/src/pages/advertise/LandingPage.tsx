import { Link } from "react-router-dom";
import {
  Megaphone,
  MapPin,
  Users,
  BarChart3,
  Play,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/Button";

const features = [
  {
    icon: Play,
    title: "Video Ads That Play",
    description:
      "Your ads run on free-with-ads channels, reaching engaged viewers across the Kolbo network.",
  },
  {
    icon: MapPin,
    title: "Geo Targeting",
    description:
      "Target viewers by city or zip code to reach exactly the audience that matters to your business.",
  },
  {
    icon: Users,
    title: "Age Range Targeting",
    description:
      "Set age demographics so your ads are shown to the right audience segment.",
  },
  {
    icon: BarChart3,
    title: "Budget Control",
    description:
      "Set a total campaign budget and daily max spend. You're always in control of your costs.",
  },
];

export default function AdvertiseLandingPage() {
  return (
    <div className="bg-surface-950">
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-amber-900/30 via-surface-950 to-surface-950" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(245,158,11,0.12),transparent_60%)]" />
        <div className="relative mx-auto max-w-7xl px-4 py-24 text-center sm:px-6 sm:py-32 lg:px-8 lg:py-40">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-600/20">
            <Megaphone className="h-8 w-8 text-amber-400" />
          </div>
          <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
            Advertise with{" "}
            <span className="bg-gradient-to-r from-amber-400 to-amber-300 bg-clip-text text-transparent">
              Kolbo
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg text-surface-300">
            Reach thousands of engaged viewers across the Kolbo streaming
            network. Target by location and demographics, and only pay for
            results.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Button size="lg" asChild>
              <Link to="/advertise/signup">
                Get Started
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link to="/advertise/login">Advertiser Log In</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <h2 className="mb-12 text-center text-2xl font-bold text-white sm:text-3xl">
          Why Advertise on Kolbo?
        </h2>
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => (
            <div
              key={f.title}
              className="rounded-xl border border-surface-800 bg-surface-900/50 p-6"
            >
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-amber-600/20">
                <f.icon className="h-5 w-5 text-amber-400" />
              </div>
              <h3 className="mb-2 text-lg font-semibold text-white">
                {f.title}
              </h3>
              <p className="text-sm leading-relaxed text-surface-400">
                {f.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-surface-800 py-20">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          <h2 className="text-2xl font-bold text-white sm:text-3xl">
            Ready to grow your business?
          </h2>
          <p className="mt-4 text-surface-400">
            Create your advertiser account in minutes and launch your first
            campaign today.
          </p>
          <Button size="lg" className="mt-8" asChild>
            <Link to="/advertise/signup">
              Create Advertiser Account
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
