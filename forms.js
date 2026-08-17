/* ============================================================================
   Forms — inline validation, autosave draft, character count, submit states.
   The Web3Forms endpoint, access key and field names are unchanged.
   ========================================================================== */
(function () {
  "use strict";

  function start(LVH) {
    const { t, svg, $, $$, on, store, Toast } = LVH;

    const RULES = {
      required: (v) => v.trim().length > 0,
      email: (v) => /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(v.trim()),
      phone: (v) => v.trim() === "" || /^[+()\d][\d\s./()-]{6,}$/.test(v.trim()),
      checked: (v, el) => el.checked
    };

    function validateField(field) {
      const control = $("input, textarea, select", field);
      if (!control) return true;
      const rules = (control.dataset.rule || "").split("|").filter(Boolean);
      const value = control.value || "";
      let ok = true;

      for (const rule of rules) {
        const [name, arg] = rule.split(":");
        if (name === "min") ok = value.trim().length >= Number(arg);
        else if (name === "optional") ok = true;
        else if (RULES[name]) ok = RULES[name](value, control);
        if (!ok) break;
      }
      // Empty optional fields are neutral, never red.
      if (!rules.includes("required") && !control.required && value.trim() === "" && control.type !== "checkbox") {
        field.classList.remove("is-invalid", "is-valid");
        control.removeAttribute("aria-invalid");
        return true;
      }
      field.classList.toggle("is-invalid", !ok);
      field.classList.toggle("is-valid", ok && value.trim() !== "");
      control.setAttribute("aria-invalid", String(!ok));
      return ok;
    }

    $$("form[data-validate]").forEach((form) => {
      const fields = $$(".field", form);
      const submitBtn = $('[type="submit"]', form);
      const successPanel = $("#formSuccess");
      const errorPanel = $("#formError");
      const autosaveKey = form.dataset.autosave;
      const savedTag = $("[data-autosave-indicator]", form);

      /* ---------------------------------------------------------- live rules */
      fields.forEach((field) => {
        const control = $("input, textarea, select", field);
        if (!control) return;
        on(control, "blur", () => validateField(field));
        on(control, "input", () => {
          if (field.classList.contains("is-invalid")) validateField(field);
        });
      });

      /* ------------------------------------------------------- character count */
      $$("[data-count-for]", form).forEach((counter) => {
        const control = $("#" + counter.dataset.countFor, form);
        if (!control) return;
        const max = Number(control.getAttribute("maxlength")) || 1200;
        const paint = () => {
          const n = control.value.length;
          counter.textContent = n + " / " + max + " " + t("form.chars");
          counter.classList.toggle("is-warn", n > max * 0.9);
        };
        on(control, "input", paint);
        paint();
      });

      /* ----------------------------------------------------------- autosave */
      if (autosaveKey) {
        const draft = store.get(autosaveKey, null);
        if (draft && Object.values(draft).some((v) => v)) {
          Object.entries(draft).forEach(([name, value]) => {
            const el = form.elements[name];
            if (el && typeof value === "string") el.value = value;
          });
          Toast.show(t("toast.draftRestored"), "info");
        }
        let timer;
        on(form, "input", () => {
          clearTimeout(timer);
          timer = setTimeout(() => {
            const data = {};
            $$("input:not([type=hidden]):not([type=checkbox]), textarea, select", form).forEach((el) => {
              if (el.name) data[el.name] = el.value;
            });
            store.set(autosaveKey, data);
            if (savedTag) {
              savedTag.classList.add("is-visible");
              setTimeout(() => savedTag.classList.remove("is-visible"), 2200);
            }
          }, 600);
        });
      }

      /* ------------------------------------------------------------- submit */
      on(form, "submit", async (e) => {
        e.preventDefault();
        errorPanel && (errorPanel.hidden = true);

        // Honeypot: silently accept and stop. It is a checkbox, whose `value`
        // is "on" even when unticked — only `checked` tells us a bot filled it.
        const trap = form.elements.botcheck;
        if (trap && (trap.type === "checkbox" ? trap.checked : trap.value)) return;

        const invalid = fields.filter((f) => !validateField(f));
        if (invalid.length) {
          Toast.show(t("toast.formError"), "error");
          const control = $("input, textarea, select", invalid[0]);
          control && control.focus();
          invalid[0].scrollIntoView({ block: "center", behavior: "smooth" });
          return;
        }

        submitBtn.classList.add("is-loading");
        submitBtn.setAttribute("aria-busy", "true");
        submitBtn.disabled = true;

        try {
          const res = await fetch("https://api.web3forms.com/submit", {
            method: "POST",
            body: new FormData(form)
          });
          const json = await res.json();
          if (!json.success) throw new Error(json.message || "failed");

          form.reset();
          autosaveKey && store.del(autosaveKey);
          fields.forEach((f) => f.classList.remove("is-valid", "is-invalid"));
          if (successPanel) {
            form.hidden = true;
            successPanel.hidden = false;
            successPanel.focus();
            successPanel.scrollIntoView({ block: "center", behavior: "smooth" });
          } else {
            Toast.show(t("form.success.t"), "success");
          }
        } catch {
          if (errorPanel) errorPanel.hidden = false;
          Toast.show(t("form.error.t"), "error");
        } finally {
          submitBtn.classList.remove("is-loading");
          submitBtn.removeAttribute("aria-busy");
          submitBtn.disabled = false;
        }
      });

      // "Write another message" resets the success state.
      const again = $("[data-form-reset]");
      on(again, "click", () => {
        $("#formSuccess").hidden = true;
        form.hidden = false;
        const first = $("input, textarea", form);
        first && first.focus();
      });
    });
  }

  if (window.LVH) start(window.LVH);
  else document.addEventListener("lvh:ready", () => start(window.LVH), { once: true });
})();
