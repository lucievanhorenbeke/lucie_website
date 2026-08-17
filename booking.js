/* ============================================================================
   Booking — accessible service picker + Calendly inline widget.
   The Calendly URL, parameters and the a1 custom answer prefill are unchanged.
   ========================================================================== */
(function () {
  "use strict";

  const CALENDLY_URL =
    "https://calendly.com/lucie-coach-pt?hide_gdpr_banner=1&primary_color=FF5C1A";

  function start(LVH) {
    const { t, $, $$, on, store, KEYS, Toast, prefersReduced } = LVH;

    const group = $("[data-choice-group]");
    if (!group) return;

    const choices = $$("[data-choice]", group);
    const step2 = $("#bookingStep2");
    const mount = $("#calendlyMount");
    const empty = $("#bookingEmpty");
    const badge = $("#selectedService");
    const dot1 = $("#stepDot1");
    const dot2 = $("#stepDot2");
    const line = $("#stepLine");

    function skeleton() {
      mount.innerHTML =
        '<div class="stack" style="padding:1.25rem;gap:.75rem">' +
        '<div class="skeleton skeleton--title"></div>' +
        '<div class="skeleton skeleton--text" style="width:90%"></div>' +
        '<div class="skeleton" style="height:280px;border-radius:16px"></div>' +
        '<div class="skeleton skeleton--text" style="width:60%"></div>' +
        "</div>";
      mount.setAttribute("aria-busy", "true");
    }

    function mountCalendly(serviceName) {
      skeleton();
      const render = () => {
        if (!window.Calendly) {
          mount.innerHTML =
            '<p class="alert alert--amber" style="margin:1rem">' +
            t("booking.loading") +
            "</p>";
          return;
        }
        mount.innerHTML = "";
        window.Calendly.initInlineWidget({
          url: CALENDLY_URL,
          parentElement: mount,
          prefill: { customAnswers: { a1: serviceName } }
        });
        mount.removeAttribute("aria-busy");
      };
      // Give the skeleton a beat so the transition reads as intentional.
      setTimeout(render, prefersReduced() ? 0 : 260);
    }

    function select(btn, { scroll = true, silent = false } = {}) {
      choices.forEach((c) => {
        const on_ = c === btn;
        c.setAttribute("aria-checked", String(on_));
        c.tabIndex = on_ ? 0 : -1;
      });

      const name = btn.dataset.choice;
      const label = $(".choice-name", btn).textContent.trim();
      store.set(KEYS.service, name);

      if (badge) {
        badge.textContent = label;
        badge.hidden = false;
      }
      dot1 && dot1.classList.replace("is-active", "is-done");
      dot2 && dot2.classList.add("is-active");
      line && line.classList.add("is-done");

      empty && (empty.hidden = true);
      step2 && (step2.hidden = false);

      mountCalendly(name);

      if (scroll && !silent) {
        setTimeout(
          () => step2.scrollIntoView({ behavior: prefersReduced() ? "auto" : "smooth", block: "start" }),
          140
        );
      }
    }

    choices.forEach((btn, i) => {
      on(btn, "click", () => select(btn));
      on(btn, "keydown", (e) => {
        const keys = ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"];
        if (keys.includes(e.key)) {
          e.preventDefault();
          const dir = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : -1;
          const next = choices[(i + dir + choices.length) % choices.length];
          next.focus();
          select(next, { scroll: false });
        } else if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          select(btn);
        }
      });
    });

    // Restore the previous pick (without yanking the page down).
    const saved = store.get(KEYS.service, null);
    if (saved) {
      const match = choices.find((c) => c.dataset.choice === saved);
      if (match) {
        select(match, { scroll: false, silent: true });
        Toast.show(t("booking.restore"), "info");
      }
    }

    // "Change service" scrolls back to the picker.
    on($("[data-change-service]"), "click", () => {
      group.scrollIntoView({ behavior: prefersReduced() ? "auto" : "smooth", block: "start" });
      const current = choices.find((c) => c.getAttribute("aria-checked") === "true") || choices[0];
      current.focus();
    });

    // Deep link: booking.html?service=Coaching%20en%20salle
    const wanted = new URLSearchParams(location.search).get("service");
    if (wanted) {
      const match = choices.find((c) => c.dataset.choice === wanted);
      match && select(match, { scroll: false });
    }
  }

  if (window.LVH) start(window.LVH);
  else document.addEventListener("lvh:ready", () => start(window.LVH), { once: true });
})();
