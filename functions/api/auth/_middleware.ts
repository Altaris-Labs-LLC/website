import { corsHeaders } from "./_lib";

export async function onRequest(context: EventContext<unknown, string, unknown>) {
  if (context.request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(context.request),
    });
  }
  return context.next();
}
