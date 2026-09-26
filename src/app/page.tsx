import { redirect } from "next/navigation";

// Middleware normally handles "/", this is a fallback.
export default function Home() {
  redirect("/dashboard");
}
