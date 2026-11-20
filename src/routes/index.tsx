import { createFileRoute } from "@tanstack/react-router";
import { Dashboard } from "@/components/liveledger/Dashboard";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "LiveLedger SDK — Real-time balance & SMS reconciliation" },
      {
        name: "description",
        content: "Drop-in real-time balance and SMS reconciliation engine for Indian banking apps, with a live host app demo.",
      },
      { property: "og:title", content: "LiveLedger SDK — Real-time balance & SMS reconciliation" },
      {
        property: "og:description",
        content: "Drop-in real-time balance and SMS reconciliation engine for Indian banking apps, with a live host app demo.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});
