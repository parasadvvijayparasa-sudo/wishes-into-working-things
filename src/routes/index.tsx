import { createFileRoute } from "@tanstack/react-router";
import { Dashboard } from "@/components/liveledger/Dashboard";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "LiveLedger — Your real balance, right now" },
      {
        name: "description",
        content: "See your live balance including pending UPI payments before your bank updates.",
      },
      { property: "og:title", content: "LiveLedger — Your real balance, right now" },
      {
        property: "og:description",
        content: "See your live balance including pending UPI payments before your bank updates.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});
