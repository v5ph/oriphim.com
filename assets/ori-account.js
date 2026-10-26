/* Ori account pages: plan status, Stripe Checkout and Portal, payment confirmation.
   Access is decided server-side from verified Stripe events; these pages only show
   it. A Checkout redirect alone never changes access. */
(function () {
  "use strict";
  var FUNCTIONS = "https://kvcoyxofptmtaywdjbzo.supabase.co/functions/v1/billing";
  var PUBLISHABLE = "sb_publishable_wRWOcUBzB0u-4zlM2qCcTQ_IovLSH7Q";

  function day(value) {
    if (!value) return "—";
    return new Date(value).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
  }

  async function session() {
    if (!window.sb) throw new Error("Sign-in is unavailable right now.");
    var result = await window.sb.auth.getSession();
    return result.data.session;
  }

  async function billing(body) {
    var current = await session();
    if (!current) throw Object.assign(new Error("Sign in first."), { signedOut: true });
    var response = await fetch(FUNCTIONS, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: PUBLISHABLE,
        Authorization: "Bearer " + current.access_token
      },
      body: JSON.stringify(body)
    });
    var data = await response.json().catch(function () { return {}; });
    if (!response.ok) {
      var messages = {
        already_subscribed: "You already have Standard. Use Manage billing to change it.",
        no_customer: "There is no billing account yet. Choose a plan first.",
        bad_interval: "Choose monthly or annual."
      };
      throw new Error(messages[data.error] || "Billing is unavailable right now (" + (data.error || response.status) + ").");
    }
    return data;
  }

  /* What the summary means, in the words the terminal also uses. */
  function describe(summary) {
    var sub = summary && summary.subscription;
    var lines = [];
    var state = "No Standard subscription";
    if (summary && summary.paid_access && sub) {
      if (sub.payment_problem) state = "Payment problem — update your card";
      else if (sub.cancel_at_period_end) state = "Cancelled — access until " + day(sub.paid_through);
      else state = "Active — renews " + day(sub.current_period_end || sub.paid_through);
    } else if (sub) {
      state = "Ended " + day(sub.paid_through);
    }
    lines.push(["Plan", sub ? "Standard · " + (sub.interval === "year" ? "$390 / year" : "$39 / month") : "None"]);
    lines.push(["Status", state]);
    if (summary && summary.paid_access) {
      lines.push(["Cloud credits", summary.monthly_remaining + " of " + (summary.monthly_amount || 500) + " this month"]);
      lines.push(["Credits expire", day(summary.monthly_expires_at) + " · no rollover"]);
    }
    if (summary && summary.promo) lines.push(["Promotional credits", String(summary.promo)]);
    if (sub && !sub.livemode) lines.push(["Mode", "Stripe test mode"]);
    return { lines: lines, problem: Boolean(sub && sub.payment_problem), paid: Boolean(summary && summary.paid_access) };
  }

  function paint(panel, rows) {
    panel.replaceChildren();
    rows.forEach(function (row) {
      var el = document.createElement("div");
      el.className = "row";
      var k = document.createElement("span"); k.className = "k"; k.textContent = row[0];
      var v = document.createElement("span"); v.className = "v"; v.textContent = row[1];
      el.append(k, v);
      panel.append(el);
    });
  }

  window.oriAccount = { session: session, billing: billing, describe: describe, paint: paint, day: day };
})();
