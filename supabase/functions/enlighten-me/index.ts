Deno.serve((_req) => {
  return Response.redirect("https://enlighten-me.co", 302);
});
