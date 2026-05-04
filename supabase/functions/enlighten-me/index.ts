Deno.serve((_req) => {
  return Response.redirect("https://new-testament-enlighten-me.vercel.app", 302);
});
