/* Oriphim — Supabase browser client.
   Same project as the Oriphim desktop app: one auth.users, one identity.
   The publishable key is meant to be shipped in the client; every table is
   guarded by RLS and privileged work happens in Edge Functions. */
(function () {
  "use strict";

  var SUPABASE_URL = "https://kvcoyxofptmtaywdjbzo.supabase.co";
  var SUPABASE_PUBLISHABLE_KEY = "sb_publishable_wRWOcUBzB0u-4zlM2qCcTQ_IovLSH7Q";

  if (!window.supabase || typeof window.supabase.createClient !== "function") {
    console.error("[oriphim] supabase-js did not load; auth is unavailable");
    return;
  }

  var sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      storageKey: "oriphim.auth",
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: "pkce"
    }
  });
  window.sb = sb;

  /* ---- nav: reflect the session on the Sign In control ---------------- */
  function displayName(user) {
    return (user && user.user_metadata && user.user_metadata.name) ||
           (user && user.email) || "Account";
  }

  function paintNav(session) {
    var btn = document.querySelector(".signin-btn");
    if (!btn) return;
    if (session) {
      btn.textContent = displayName(session.user);
      btn.setAttribute("href", "#");
      btn.setAttribute("data-auth-signout", "");
      btn.setAttribute("title", "Sign out");
    } else {
      btn.textContent = "Sign In";
      btn.setAttribute("href", "/sign-in");
      btn.removeAttribute("data-auth-signout");
      btn.removeAttribute("title");
    }
  }

  sb.auth.getSession().then(function (res) { paintNav(res.data.session); });
  sb.auth.onAuthStateChange(function (_evt, session) { paintNav(session); });

  document.addEventListener("click", function (e) {
    var t = e.target.closest("[data-auth-signout]");
    if (!t) return;
    e.preventDefault();
    sb.auth.signOut().then(function () { window.location.assign("/"); });
  });

  /* ---- helpers the auth forms call (see script.js) ------------------- */
  window.oriphimAuth = {
    client: sb,
    signIn: function (email, password) {
      return sb.auth.signInWithPassword({ email: email, password: password });
    },
    signInWithProvider: function (provider) {
      if (provider !== "github" && provider !== "google") {
        return Promise.reject(new Error("Unsupported sign-in provider."));
      }
      var destination = new URL(window.location.href);
      var next = destination.searchParams.get("next");
      if (next) {
        var requested = new URL(next, window.location.origin);
        if (requested.origin === window.location.origin) destination = requested;
      }
      ["auth", "next", "code", "error", "error_code", "error_description"].forEach(function (key) {
        destination.searchParams.delete(key);
      });
      destination.hash = "";
      return sb.auth.signInWithOAuth({
        provider: provider,
        options: { redirectTo: destination.href }
      });
    },
    signUp: function (email, password, name) {
      return sb.auth.signUp({
        email: email,
        password: password,
        options: {
          data: name ? { name: name } : undefined,
          emailRedirectTo: window.location.origin + "/sign-in"
        }
      });
    },
    signOut: function () { return sb.auth.signOut(); }
  };
})();
