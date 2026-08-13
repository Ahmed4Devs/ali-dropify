import { toNextJsHandler } from "better-auth/next-js";
import { assertProductionAuthConfiguration, auth } from "@/lib/auth";

const handlers = toNextJsHandler(auth);

export async function GET(request: Request) {
  assertProductionAuthConfiguration();
  return handlers.GET(request);
}

export async function POST(request: Request) {
  assertProductionAuthConfiguration();
  return handlers.POST(request);
}
