(() => {
  const modal = document.getElementById("authModal");
  if (!modal) return;

  const closeTargets = modal.querySelectorAll("[data-auth-close]");
  const switchButtons = modal.querySelectorAll("[data-auth-switch]");
  const methodButtons = modal.querySelectorAll("[data-auth-method]");
  const continueBtn = modal.querySelector("[data-auth-continue]");
  const track = modal.querySelector("[data-auth-track]");

  let stepEls = Array.from(modal.querySelectorAll(".auth-step"));
  let loginForm = null;
  let registerForm = null;
  let otpStep = null;
  let otpInputs = [];
  let otpSubmit = null;
  let otpResend = null;
  let otpTimerLabel = null;
  let otpResendLabel = null;
  let otpEmail = null;
  let otpBack = null;
  let registerBack = null;
  let loginError = null;
  let registerError = null;
  let otpError = null;

  const bindElements = () => {
    stepEls = Array.from(modal.querySelectorAll(".auth-step"));
    loginForm = modal.querySelector("[data-auth-login]");
    registerForm = modal.querySelector("[data-auth-register-email]");
    otpStep = modal.querySelector("[data-step='otp']");
    otpInputs = otpStep ? otpStep.querySelectorAll(".otp-inputs input") : [];
    otpSubmit = otpStep ? otpStep.querySelector("[data-otp-submit]") : null;
    otpResend = otpStep ? otpStep.querySelector("[data-otp-resend]") : null;
    otpTimerLabel = otpStep ? otpStep.querySelector("[data-otp-timer]") : null;
    otpResendLabel = otpResend ? otpResend.querySelector("[data-otp-label]") : null;
    otpEmail = otpStep ? otpStep.querySelector("[data-otp-email]") : null;
    otpBack = otpStep ? otpStep.querySelector("[data-otp-back]") : null;
    registerBack = modal.querySelector("[data-register-back]");
    loginError = modal.querySelector("[data-auth-error]");
    registerError = modal.querySelector("[data-register-error]");
    otpError = otpStep ? otpStep.querySelector("[data-otp-error]") : null;
  };

  bindElements();
  const loginSnapshotHtml = (() => {
    const loginStep = modal.querySelector("[data-step='login']");
    return loginStep ? loginStep.innerHTML : "";
  })();

  const focusableSelectors =
    'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';
  const steps = ["login", "register", "register-email", "otp"];
  let selectedMethod = "email";
  let activeStep = "register";
  let lastOtpStep = "login";
  let resendTimer = null;
  let resendSeconds = 0;
  let cachedLogin = { email: "", password: "", flow: "login" };
  let lastFocused = null;

  const restoreLoginStep = () => {
    const loginStep = modal.querySelector("[data-step='login']");
    if (!loginStep || !loginSnapshotHtml) return;
    const missingCore =
      !loginStep.querySelector(".auth-app-icon") ||
      !loginStep.querySelector("h2") ||
      !loginStep.querySelector(".auth-subtitle") ||
      !loginStep.querySelector(".auth-divider") ||
      !loginStep.querySelector(".telegram-btn");
    if (missingCore) {
      loginStep.innerHTML = loginSnapshotHtml;
      bindElements();
    }
  };

  const getFocusable = () =>
    Array.from(modal.querySelectorAll(focusableSelectors)).filter(
      (el) => !el.hasAttribute("disabled") && el.getAttribute("tabindex") !== "-1"
    );

  const syncTabIndex = (container, isActive) => {
    container
      .querySelectorAll("input, button, a, select, textarea, [tabindex]")
      .forEach((el) => {
        if (isActive) {
          if (el.hasAttribute("data-orig-tabindex")) {
            const original = el.getAttribute("data-orig-tabindex");
            if (original === "") {
              el.removeAttribute("tabindex");
            } else {
              el.setAttribute("tabindex", original);
            }
            el.removeAttribute("data-orig-tabindex");
          }
        } else {
          if (!el.hasAttribute("data-orig-tabindex")) {
            const current = el.getAttribute("tabindex");
            el.setAttribute("data-orig-tabindex", current === null ? "" : current);
          }
          el.setAttribute("tabindex", "-1");
        }
      });
  };

  const setStep = (nextStep) => {
    const previousIndex = steps.indexOf(activeStep);
    const nextIndex = steps.indexOf(nextStep);
    const direction = nextIndex > previousIndex ? "forward" : nextIndex < previousIndex ? "back" : null;
    activeStep = nextStep;
    const index = steps.indexOf(nextStep);
    if (track && index >= 0) {
      track.style.setProperty("--auth-x", `-${index * 100}%`);
    }
    stepEls.forEach((stepEl) => {
      const isActive = stepEl.dataset.step === nextStep;
      if (!isActive && stepEl.contains(document.activeElement)) {
        document.activeElement.blur();
      }
      stepEl.classList.toggle("is-active", isActive);
      stepEl.setAttribute("aria-hidden", isActive ? "false" : "true");
      if (isActive) {
        stepEl.removeAttribute("inert");
      } else {
        stepEl.setAttribute("inert", "");
      }
      syncTabIndex(stepEl, isActive);
      stepEl.classList.remove("is-enter-forward", "is-enter-back");
      if (isActive && direction) {
        void stepEl.offsetWidth;
        stepEl.classList.add(direction === "forward" ? "is-enter-forward" : "is-enter-back");
        window.setTimeout(() => {
          stepEl.classList.remove("is-enter-forward", "is-enter-back");
        }, 350);
      }
    });
    if (nextStep === "otp") {
      modal.classList.add("otp-animate");
      window.setTimeout(() => modal.classList.remove("otp-animate"), 700);
      if (otpInputs.length) {
        otpInputs[0].focus();
      }
      syncOtpSubmit();
    }
    if (nextStep === "login" && loginForm) {
      const input = loginForm.querySelector("#loginEmail");
      if (input) input.focus();
    }
    if (nextStep === "login") {
      restoreLoginStep();
      ensureLoginCopy();
    }
    if (nextStep === "register-email" && registerForm) {
      const input = registerForm.querySelector("#registerEmail");
      if (input) input.focus();
    }
    if (nextStep === "register" && methodButtons.length) {
      methodButtons[0].focus();
    }
  };

  const ensureLoginCopy = () => {
    const loginStep = modal.querySelector("[data-step='login']");
    if (!loginStep) return;

    const ensureText = (selector, text) => {
      const node = loginStep.querySelector(selector);
      if (!node) return null;
      if (!node.textContent || !node.textContent.trim()) {
        node.textContent = text;
      }
      return node;
    };

    if (!loginStep.querySelector(".auth-app-icon")) {
      const icon = document.createElement("div");
      icon.className = "auth-app-icon";
      icon.textContent = "П";
      loginStep.prepend(icon);
    }

    if (!loginStep.querySelector("h2")) {
      const title = document.createElement("h2");
      title.textContent = "С возвращением";
      const icon = loginStep.querySelector(".auth-app-icon");
      if (icon && icon.nextSibling) {
        icon.insertAdjacentElement("afterend", title);
      } else {
        loginStep.prepend(title);
      }
    } else {
      ensureText("h2", "С возвращением");
    }

    if (!loginStep.querySelector(".auth-subtitle")) {
      const subtitle = document.createElement("p");
      subtitle.className = "auth-subtitle";
      subtitle.textContent = "Введите данные для входа в систему";
      const title = loginStep.querySelector("h2");
      if (title) {
        title.insertAdjacentElement("afterend", subtitle);
      } else {
        loginStep.prepend(subtitle);
      }
    } else {
      ensureText(".auth-subtitle", "Введите данные для входа в систему");
    }

    const labels = loginStep.querySelectorAll(".auth-label");
    if (labels.length >= 2) {
      if (!labels[0].textContent || !labels[0].textContent.trim()) {
        labels[0].textContent = "ЛОГИН";
      }
      if (!labels[1].textContent || !labels[1].textContent.trim()) {
        labels[1].textContent = "ПАРОЛЬ";
      }
    }

    const forgot = loginStep.querySelector(".auth-forgot .auth-link");
    if (forgot && (!forgot.textContent || !forgot.textContent.trim())) {
      forgot.textContent = "Забыли пароль?";
    }

    const submitBtn = loginStep.querySelector(".auth-submit");
    if (submitBtn && (!submitBtn.textContent || !submitBtn.textContent.trim())) {
      submitBtn.textContent = "Войти в систему";
    }

    if (!loginStep.querySelector(".auth-divider")) {
      const divider = document.createElement("div");
      divider.className = "auth-divider";
      divider.innerHTML = "<span>ИЛИ</span>";
      const form = loginStep.querySelector(".auth-form");
      if (form) {
        form.insertAdjacentElement("afterend", divider);
      } else {
        loginStep.appendChild(divider);
      }
    }

    const telegramBtn = loginStep.querySelector(".telegram-btn");
    if (telegramBtn && (!telegramBtn.textContent || !telegramBtn.textContent.trim())) {
      telegramBtn.insertAdjacentText("beforeend", "Войти через Telegram");
    }

    if (!loginStep.querySelector(".auth-switch")) {
      const switchWrap = document.createElement("div");
      switchWrap.className = "auth-switch";
      switchWrap.innerHTML =
        'Нет аккаунта? <button class="auth-link" data-auth-switch="register">Зарегистрироваться</button>';
      loginStep.appendChild(switchWrap);
    }
  };

  const modalObserver = new MutationObserver(() => {
    if (!modal.classList.contains("active")) return;
    restoreLoginStep();
    ensureLoginCopy();
  });

  modalObserver.observe(modal, { childList: true, subtree: true });

  const openModal = (nextStep) => {
    lastFocused = document.activeElement;
    restoreLoginStep();
    modal.classList.add("active");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
    setStep(nextStep || activeStep);
  };

  const closeModal = () => {
    modal.classList.remove("active");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
    if (lastFocused && typeof lastFocused.focus === "function") {
      lastFocused.focus();
    }
  };

  const setError = (el, message) => {
    if (!el) return;
    if (!message) {
      el.hidden = true;
      el.textContent = "";
      return;
    }
    el.hidden = false;
    el.textContent = message;
  };

  const maskEmail = (email) => {
    if (!email) return "user@prostovki.com";
    const [name, domain] = email.split("@");
    if (!domain) return email;
    const masked = name.length > 2 ? `${name.slice(0, 2)}***` : `${name}***`;
    return `${masked}@${domain}`;
  };

  const startResendTimer = (seconds) => {
    resendSeconds = Math.max(seconds, 1) - 1;
    if (resendTimer) {
      window.clearTimeout(resendTimer);
      resendTimer = null;
    }
    if (otpResend) {
      otpResend.disabled = true;
      otpResend.classList.remove("is-active");
    }
    const formatTime = (value) => {
      const mm = String(Math.floor(value / 60)).padStart(2, "0");
      const ss = String(value % 60).padStart(2, "0");
      return `${mm}:${ss}`;
    };
    const updateLabel = () => {
      const label = otpResendLabel ? otpResendLabel.querySelector("[data-otp-timer]") : otpTimerLabel;
      if (label) label.textContent = formatTime(resendSeconds);
    };
    const tick = () => {
      updateLabel();
      if (resendSeconds <= 0) {
        if (otpResend) {
          otpResend.disabled = false;
          otpResend.classList.add("is-active");
          if (otpResendLabel) {
            otpResendLabel.textContent = "Отправить повторно";
          }
        }
        return;
      }
      resendSeconds -= 1;
      resendTimer = window.setTimeout(tick, 1000);
    };
    if (otpResendLabel) {
      otpResendLabel.innerHTML = `Отправить повторно через <span data-otp-timer>${formatTime(
        resendSeconds
      )}</span>`;
    }
    tick();
  };

  const collectOtp = () => Array.from(otpInputs).map((input) => input.value).join("");
  const syncOtpSubmit = () => {
    if (!otpSubmit) return;
    const code = collectOtp();
    otpSubmit.disabled = code.length !== 6;
  };

  methodButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      methodButtons.forEach((item) => item.classList.remove("is-selected"));
      btn.classList.add("is-selected");
      selectedMethod = btn.dataset.authMethod;
    });
  });

  if (continueBtn) {
    continueBtn.addEventListener("click", () => {
      if (selectedMethod === "telegram") {
        window.open("/auth/register/telegram", "_blank");
        return;
      }
      setStep("register-email");
    });
  }

  switchButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.authSwitch;
      if (target) {
        setStep(target);
      }
    });
  });

  closeTargets.forEach((el) => el.addEventListener("click", closeModal));

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && modal.classList.contains("active")) {
      closeModal();
    }
    if (event.key === "Tab" && modal.classList.contains("active")) {
      const focusable = getFocusable();
      if (!focusable.length) return;
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
  });

  document.querySelectorAll("[data-auth-trigger]").forEach((btn) => {
    btn.addEventListener("click", () => {
      openModal(btn.dataset.authTrigger);
    });
  });

  const handleLoginSubmit = async (form, event) => {
    event.preventDefault();
    bindElements();
    setError(loginError, "");
    const formData = new FormData(form);
      cachedLogin.email = String(formData.get("email") || "");
      cachedLogin.password = String(formData.get("password") || "");
      cachedLogin.flow = "login";
      try {
        const response = await fetch("/auth/login/email", {
          method: "POST",
          headers: {
            Accept: "application/json",
            "X-Requested-With": "fetch",
          },
          body: formData,
          credentials: "same-origin",
        });
        const contentType = response.headers.get("content-type") || "";
        if (response.redirected || !contentType.includes("application/json")) {
          setError(loginError, "Сервер вернул HTML. Попробуйте еще раз.");
          return;
        }
        const payload = await response.json();
        if (!response.ok || !payload.success) {
          setError(loginError, payload.error || "Неверный логин или пароль.");
          return;
        }
        bindElements();
        if (otpEmail) {
          otpEmail.textContent = payload.masked_email || maskEmail(cachedLogin.email);
        }
        lastOtpStep = "login";
        if (payload.next === "otp" || !payload.next) {
          setStep("otp");
          startResendTimer(60);
        }
      } catch (err) {
        setError(loginError, "Не удалось отправить код. Попробуйте еще раз.");
      }
  };

  if (loginForm) {
    loginForm.addEventListener("submit", (event) => handleLoginSubmit(loginForm, event));
  }

  const handleRegisterSubmit = async (form, event) => {
    event.preventDefault();
    bindElements();
    setError(registerError, "");
    const formData = new FormData(form);
      cachedLogin.email = String(formData.get("email") || "");
      cachedLogin.password = String(formData.get("password") || "");
      cachedLogin.flow = "register";
      try {
        const response = await fetch("/auth/register/email", {
          method: "POST",
          headers: {
            Accept: "application/json",
            "X-Requested-With": "fetch",
          },
          body: formData,
          credentials: "same-origin",
        });
        const contentType = response.headers.get("content-type") || "";
        if (response.redirected || !contentType.includes("application/json")) {
          setError(registerError, "Сервер вернул HTML. Попробуйте еще раз.");
          return;
        }
        const payload = await response.json();
        if (!response.ok || !payload.success) {
          setError(registerError, payload.error || "Не удалось отправить код. Проверьте данные.");
          return;
        }
        bindElements();
        if (otpEmail) {
          otpEmail.textContent = payload.masked_email || maskEmail(cachedLogin.email);
        }
        lastOtpStep = "register-email";
        if (payload.next === "otp" || !payload.next) {
          setStep("otp");
          startResendTimer(60);
        }
      } catch (err) {
        setError(registerError, "Не удалось отправить код. Попробуйте еще раз.");
      }
  };

  if (registerForm) {
    registerForm.addEventListener("submit", (event) => handleRegisterSubmit(registerForm, event));
  }

  if (otpInputs.length) {
    otpInputs.forEach((input, index) => {
      input.addEventListener("input", (event) => {
        const value = event.target.value.replace(/\D/g, "");
        event.target.value = value.slice(-1);
        if (value && otpInputs[index + 1]) {
          otpInputs[index + 1].focus();
        }
        syncOtpSubmit();
      });

      input.addEventListener("keydown", (event) => {
        if (event.key === "Backspace" && !event.target.value && otpInputs[index - 1]) {
          otpInputs[index - 1].focus();
        }
        if (event.key === "Backspace") {
          window.setTimeout(syncOtpSubmit, 0);
        }
      });

      input.addEventListener("paste", (event) => {
        event.preventDefault();
        const pasted = (event.clipboardData || window.clipboardData)
          .getData("text")
          .replace(/\D/g, "")
          .slice(0, otpInputs.length);
        pasted.split("").forEach((char, idx) => {
          if (otpInputs[idx]) otpInputs[idx].value = char;
        });
        if (otpInputs[pasted.length - 1]) {
          otpInputs[pasted.length - 1].focus();
        }
        syncOtpSubmit();
      });
    });
  }

  if (otpSubmit) {
    otpSubmit.addEventListener("click", async () => {
      setError(otpError, "");
      const code = collectOtp();
      if (code.length !== 6) {
        setError(otpError, "Введите все 6 цифр кода.");
        return;
      }
      const payload = new FormData();
      payload.append("code", code);
      try {
        const response = await fetch("/auth/verify", {
          method: "POST",
          headers: {
            Accept: "application/json",
            "X-Requested-With": "fetch",
          },
          body: payload,
          credentials: "same-origin",
        });
        const contentType = response.headers.get("content-type") || "";
        if (response.redirected || !contentType.includes("application/json")) {
          setError(otpError, "Сервер вернул HTML. Попробуйте еще раз.");
          return;
        }
        const data = await response.json();
        if (!response.ok || !data.success) {
          setError(otpError, data.error || "Неверный или просроченный код.");
          return;
        }
        if (data.redirect) {
          window.location.href = data.redirect;
        }
      } catch (err) {
        setError(otpError, "Ошибка проверки кода.");
      }
    });
  }

  modal.addEventListener("submit", (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;
    if (form.matches("[data-auth-login]")) {
      handleLoginSubmit(form, event);
    }
    if (form.matches("[data-auth-register-email]")) {
      handleRegisterSubmit(form, event);
    }
  });

  if (otpResend) {
    otpResend.addEventListener("click", async () => {
      if (otpResend.disabled) return;
      setError(otpError, "");
      try {
        const payload = new FormData();
        payload.append("email", cachedLogin.email);
        payload.append("password", cachedLogin.password);
        const endpoint = cachedLogin.flow === "register" ? "/auth/register/email" : "/auth/login/email";
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            Accept: "application/json",
            "X-Requested-With": "fetch",
          },
          body: payload,
          credentials: "same-origin",
        });
        const contentType = response.headers.get("content-type") || "";
        if (response.redirected || !contentType.includes("application/json")) {
          setError(otpError, "Сервер вернул HTML. Попробуйте позже.");
          return;
        }
        const data = await response.json();
        if (!response.ok || !data.success) {
          setError(otpError, data.error || "Не удалось отправить код. Попробуйте позже.");
          return;
        }
        startResendTimer(60);
      } catch (err) {
        setError(otpError, "Не удалось отправить код. Попробуйте позже.");
      }
    });
  }

  if (otpBack) {
    otpBack.addEventListener("click", () => {
      setStep(lastOtpStep);
    });
  }

  if (registerBack) {
    registerBack.addEventListener("click", () => {
      setStep("register");
    });
  }

  const params = new URLSearchParams(window.location.search);
  if (params.has("auth")) {
    openModal(params.get("auth"));
  }
})();
