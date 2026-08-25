import { createFileRoute } from "@tanstack/react-router";
import { HoneyAce } from "@/components/HoneyAce";

export const Route = createFileRoute("/")({
  component: Home,
});


function Home() {
  return <HoneyAce />;
}
