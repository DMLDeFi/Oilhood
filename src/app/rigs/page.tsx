import type { Metadata } from "next";
import { RigsBoard } from "@/components/RigsBoard";

export const metadata: Metadata = {
  title: "Virtual Rigs",
  description: "Hold $OILHOOD to run a virtual oil rig that earns points every hour. Leaderboard, tiers and rules.",
};

export default function RigsPage() {
  return <RigsBoard />;
}
