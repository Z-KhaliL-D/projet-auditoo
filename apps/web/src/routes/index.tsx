import { createFileRoute } from "@tanstack/react-router";
import { LevelsScreen } from "@/features/levels/LevelsScreen";

export const Route = createFileRoute("/")({
  component: LevelsScreen,
});
