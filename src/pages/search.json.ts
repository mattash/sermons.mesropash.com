import { getCollection } from "astro:content";
import { sortSermons } from "../lib/archive";

export async function GET() {
  const sermons = sortSermons(await getCollection("sermons"));
  return new Response(JSON.stringify(sermons.map(({ id, data }) => ({ id, data }))), {
    headers: { "Content-Type": "application/json; charset=utf-8" }
  });
}
