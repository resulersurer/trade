// Intentionally no public API routes; D1 binding smoke-check only.
export default {
 async fetch() {
  return new Response('Paper database worker is not publicly exposed.', {status:404,headers:{'cache-control':'no-store'}});
 }
};
