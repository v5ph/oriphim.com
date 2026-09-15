(function () {
  const assetUrl = (path) => new URL(path, document.currentScript?.src || window.location.href).href;
  const header = document.querySelector(".site-header");
  const toggle = document.querySelector(".nav-toggle");
  const nav = document.querySelector(".site-nav");

  if (header && toggle && nav) {
    toggle.addEventListener("click", () => {
      const open = header.classList.toggle("nav-open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      toggle.setAttribute("aria-label", open ? "Close navigation" : "Open navigation");
    });

    nav.addEventListener("click", (event) => {
      if (event.target.closest("a")) {
        header.classList.remove("nav-open");
        toggle.setAttribute("aria-expanded", "false");
        toggle.setAttribute("aria-label", "Open navigation");
      }
    });
  }

  const dropdownCloseTimers = new WeakMap();

  const setDropdownOpen = (menu, open) => {
    const timer = dropdownCloseTimers.get(menu);
    if (timer) window.clearTimeout(timer);

    menu.classList.toggle("is-open", open);
    menu.querySelector(".nav-trigger")?.setAttribute("aria-expanded", open ? "true" : "false");
  };

  const scheduleDropdownClose = (menu) => {
    const timer = dropdownCloseTimers.get(menu);
    if (timer) window.clearTimeout(timer);

    dropdownCloseTimers.set(menu, window.setTimeout(() => {
      setDropdownOpen(menu, false);
    }, 420));
  };

  const closeDropdowns = () => {
    document.querySelectorAll("[data-dropdown].is-open").forEach((menu) => {
      setDropdownOpen(menu, false);
    });
  };

  document.querySelectorAll("[data-dropdown]").forEach((menu) => {
    const trigger = menu.querySelector(".nav-trigger");

    menu.addEventListener("pointerenter", () => {
      setDropdownOpen(menu, true);
    });

    menu.addEventListener("pointerleave", () => {
      scheduleDropdownClose(menu);
    });

    menu.addEventListener("focusin", () => {
      setDropdownOpen(menu, true);
    });

    menu.addEventListener("focusout", (event) => {
      if (!menu.contains(event.relatedTarget)) scheduleDropdownClose(menu);
    });

    if (trigger?.tagName === "BUTTON") {
      trigger.addEventListener("click", (event) => {
        event.stopPropagation();
        const willOpen = !menu.classList.contains("is-open");
        closeDropdowns();
        setDropdownOpen(menu, willOpen);
      });
    }
  });

  const authModes = {
    "sign-in": {
      eyebrow: "ORIPHIM ACCESS",
      title: "Sign in",
      submit: "Sign In",
      switchText: "No account yet?",
      switchAction: "Create one",
      switchMode: "sign-up",
      message: "Account access is not live from this static preview.",
      art: "assets/sign-in-city.jpg",
      fields: [
        { label: "Email", type: "email", name: "email", autocomplete: "email", required: true },
        { label: "Password", type: "password", name: "password", autocomplete: "current-password", required: true }
      ]
    },
    "sign-up": {
      eyebrow: "START WITH <span class=\"oriphim-word\">ORIPHIM</span>",
      title: "Create account",
      submit: "Create Account",
      switchText: "Already registered?",
      switchAction: "Sign in",
      switchMode: "sign-in",
      message: "Account creation is not live from this static preview.",
      art: "assets/sign-up-library.jpg",
      fields: [
        { label: "Name", type: "text", name: "name", autocomplete: "name", required: true },
        { label: "Email", type: "email", name: "email", autocomplete: "email", required: true },
        { label: "Password", type: "password", name: "password", autocomplete: "new-password", required: true, minlength: 8 }
      ]
    }
  };

  const injectAuthStyles = () => {
    if (document.getElementById("oriphim-auth-modal-styles")) return;

    const style = document.createElement("style");
    style.id = "oriphim-auth-modal-styles";
    style.textContent = `
      .auth-popup[hidden]{display:none}
      .auth-popup{position:fixed;inset:0;z-index:1000;display:grid;place-items:center;padding:22px;background:rgba(24,19,15,.64);backdrop-filter:blur(3px)}
      .auth-popup::before{content:"";position:absolute;inset:0;background:linear-gradient(to right,rgba(236,228,211,.13) 1px,transparent 1px),linear-gradient(to bottom,rgba(236,228,211,.13) 1px,transparent 1px);background-size:48px 48px;pointer-events:none}
      .auth-popup__panel{position:relative;z-index:1;width:min(820px,100%);display:grid;grid-template-columns:minmax(0,1fr) 260px;border:1px solid #18130f;background:#ece4d3;color:#18130f;box-shadow:none}
      .auth-popup__content{padding:32px}
      .auth-popup__art{display:grid;place-items:center;border-left:1px solid #18130f;background:#f34b03;overflow:hidden}
      .auth-popup__art img{width:100%;height:100%;object-fit:cover;object-position:center;display:block}
      .auth-popup__top{display:flex;align-items:center;justify-content:space-between;gap:18px;margin-bottom:30px}
      .auth-popup__brand{display:flex;align-items:center;gap:10px;font-family:'Jacquard 12','Fraunces',Georgia,serif;font-size:32px;line-height:1;text-transform:lowercase}
      .auth-popup__brand img{width:34px;height:34px;object-fit:contain;display:block}
      .auth-popup .oriphim-word{display:inline-block;font-family:'Jacquard 12','Fraunces',Georgia,serif;font-size:1.32em;font-weight:400;letter-spacing:.03em;text-transform:lowercase;line-height:.62;vertical-align:-.08em}
      .auth-popup__close{width:38px;height:38px;border:1px solid #18130f;background:transparent;color:#18130f;font-family:'IBM Plex Mono','Courier New',monospace;font-size:18px;line-height:1;cursor:pointer}
      .auth-popup__close:hover{background:#18130f;color:#ece4d3}
      .auth-popup__eyebrow{margin:0 0 12px;font-family:'IBM Plex Mono','Courier New',monospace;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#241d16}
      .auth-popup h2{margin:0 0 24px;font-family:'Fraunces',Georgia,serif;font-size:clamp(36px,7vw,64px);font-weight:560;line-height:.96;color:#18130f;text-transform:none}
      .auth-popup form{display:grid;gap:15px}
      .auth-popup label{display:grid;gap:8px;font-family:'IBM Plex Mono','Courier New',monospace;font-size:11.5px;letter-spacing:.08em;text-transform:uppercase;color:#241d16}
      .auth-popup input{width:100%;min-height:48px;border:1px solid #18130f;background:#f4eee0;color:#18130f;padding:12px 13px;font:inherit;outline:none}
      .auth-popup input:focus{box-shadow:inset 0 0 0 3px #f34b03}
      .auth-popup__submit{min-height:50px;border:1px solid #18130f;background:#18130f;color:#ece4d3;padding:13px 18px;font-family:'IBM Plex Mono','Courier New',monospace;font-size:12px;letter-spacing:.08em;text-transform:uppercase;cursor:pointer}
      .auth-popup__submit:hover{background:transparent;color:#18130f}
      .auth-popup__status{min-height:18px;margin:0;font-family:'IBM Plex Mono','Courier New',monospace;font-size:11.5px;letter-spacing:.04em;color:#9c2c12}
      .auth-popup__switch{margin:18px 0 0;font-family:'IBM Plex Mono','Courier New',monospace;font-size:12px;color:#241d16}
      .auth-popup__switch a{color:#18130f;text-decoration:underline;text-decoration-thickness:1px;text-underline-offset:4px}
      @media(max-width:680px){.auth-popup__panel{grid-template-columns:1fr}.auth-popup__art{display:none}.auth-popup__content{padding:26px}.auth-popup h2{font-size:42px}}
    `;
    document.head.appendChild(style);
  };

  let authPopup = null;
  let lastFocused = null;

  const getAuthPathMode = (href) => {
    try {
      const url = new URL(href, window.location.href);
      if (url.origin !== window.location.origin) return null;
      const path = url.pathname.replace(/\/$/, "");
      if (path === "/sign-in") return "sign-in";
      if (path === "/sign-up") return "sign-up";
    } catch {
      return null;
    }
    return null;
  };

  const fieldMarkup = (field) => {
    const attrs = [
      `type="${field.type}"`,
      `name="${field.name}"`,
      `autocomplete="${field.autocomplete}"`,
      field.required ? "required" : "",
      field.minlength ? `minlength="${field.minlength}"` : ""
    ].filter(Boolean).join(" ");

    return `<label>${field.label}<input ${attrs}></label>`;
  };

  const renderAuthPopup = (mode) => {
    injectAuthStyles();
    const config = authModes[mode];

    if (!authPopup) {
      authPopup = document.createElement("div");
      authPopup.className = "auth-popup";
      authPopup.hidden = true;
      authPopup.setAttribute("role", "dialog");
      authPopup.setAttribute("aria-modal", "true");
      document.body.appendChild(authPopup);

      authPopup.addEventListener("click", (event) => {
        if (event.target === authPopup || event.target.closest("[data-auth-close]")) {
          closeAuthPopup();
          return;
        }

        const switchLink = event.target.closest("[data-auth-switch]");
        if (switchLink) {
          event.preventDefault();
          renderAuthPopup(switchLink.dataset.authSwitch);
        }
      });
    }

    authPopup.setAttribute("aria-labelledby", "auth-popup-title");
    authPopup.innerHTML = `
      <section class="auth-popup__panel">
        <div class="auth-popup__content">
          <div class="auth-popup__top">
      <span class="auth-popup__brand"><img src="${assetUrl("assets/oriphim-icon.svg")}" alt="" aria-hidden="true">oriphim</span>
            <button class="auth-popup__close" type="button" data-auth-close aria-label="Close">x</button>
          </div>
          <p class="auth-popup__eyebrow">${config.eyebrow}</p>
          <h2 id="auth-popup-title">${config.title}</h2>
          <form data-static-form data-auth-mode="${mode}" data-form-message="${config.message}">
            ${config.fields.map(fieldMarkup).join("")}
            <button class="auth-popup__submit" type="submit">${config.submit}</button>
            <p class="auth-popup__status form-status" role="status" aria-live="polite"></p>
          </form>
          <p class="auth-popup__switch">${config.switchText} <a href="/${config.switchMode}" data-auth-switch="${config.switchMode}">${config.switchAction}</a></p>
        </div>
        <aside class="auth-popup__art" aria-hidden="true"><img src="${assetUrl(config.art)}" alt=""></aside>
      </section>
    `;
  };

  const openAuthPopup = (mode) => {
    if (!authModes[mode]) return;
    lastFocused = document.activeElement;
    renderAuthPopup(mode);
    authPopup.hidden = false;
    document.documentElement.style.overflow = "hidden";
    authPopup.querySelector("input, button, a")?.focus();
  };

  const closeAuthPopup = () => {
    if (!authPopup || authPopup.hidden) return;
    authPopup.hidden = true;
    document.documentElement.style.overflow = "";
    lastFocused?.focus?.();
  };

  document.addEventListener("click", (event) => {
    const authLink = event.target.closest("a[href]");
    if (!authLink || event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || authLink.target) return;

    const mode = getAuthPathMode(authLink.getAttribute("href"));
    if (!mode) return;

    event.preventDefault();
    closeDropdowns();
    openAuthPopup(mode);
  });

  document.addEventListener("click", (event) => {
    if (!event.target.closest("[data-dropdown]")) {
      closeDropdowns();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Tab" && authPopup && !authPopup.hidden) {
      const focusable = Array.from(authPopup.querySelectorAll("a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex='-1'])"));
      if (focusable.length) {
        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }

    if (event.key === "Escape") {
      closeDropdowns();
      closeAuthPopup();
    }
  });

  document.addEventListener("submit", async (event) => {
    const form = event.target.closest("[data-static-form]");
    if (!form) return;

    event.preventDefault();
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const status = form.querySelector(".form-status");
    const setStatus = (msg, ok) => {
      if (!status) return;
      status.textContent = msg;
      if (ok) status.setAttribute("data-ok", "");
      else status.removeAttribute("data-ok");
    };

    const fields = Object.fromEntries(new FormData(form).entries());
    const mode = form.dataset.authMode || (fields.name !== undefined ? "sign-up" : "sign-in");

    // No Supabase client on the page (script failed to load) — fall back.
    if (!window.oriphimAuth) {
      setStatus(form.dataset.formMessage || "Authentication is temporarily unavailable.");
      return;
    }

    const submit = form.querySelector('button[type="submit"], .auth-submit, .auth-popup__submit');
    const submitLabel = submit && submit.textContent;
    if (submit) { submit.disabled = true; submit.textContent = "…"; }
    setStatus("");

    try {
      if (mode === "sign-up") {
        const { data, error } = await window.oriphimAuth.signUp(fields.email, fields.password, fields.name);
        if (error) throw error;
        if (data.session) {
          window.location.assign("/");
        } else {
          setStatus("Check your email to confirm your account.", true);
        }
      } else {
        const { error } = await window.oriphimAuth.signIn(fields.email, fields.password);
        if (error) throw error;
        const next = new URLSearchParams(window.location.search).get("next");
        window.location.assign(next && next.charAt(0) === "/" ? next : "/");
      }
    } catch (err) {
      setStatus((err && err.message) || "Something went wrong. Try again.");
    } finally {
      if (submit) { submit.disabled = false; submit.textContent = submitLabel; }
    }
  });
})();
