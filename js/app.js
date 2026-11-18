import {
  isConfigured, watchAuth, getProfile, register, login, loginWithGoogle, resetPassword,
  logout, updateName, resendVerification, learnStatus, linkLearn, unlinkLearn, openLearn, learnUrl, humanError, isSilentError
} from "./auth.js";

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

document.documentElement.classList.add("js");

/* =========================================================
   Уведомления
   ========================================================= */
const toastEl = $("#toast");
let toastTimer;
function toast(message) {
  toastEl.textContent = message;
  toastEl.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("show"), 4200);
}

/* =========================================================
   Открывающая анимация hero
   ========================================================= */
(function intro() {
  const img = $(".hero__img");
  const go = () => requestAnimationFrame(() => requestAnimationFrame(() => document.body.classList.remove("is-loading")));
  if (img && !img.complete) {
    const loaded = new Promise((res) => {
      img.addEventListener("load", res, { once: true });
      img.addEventListener("error", res, { once: true });
    });
    Promise.race([loaded, new Promise((r) => setTimeout(r, 1400))]).then(go);
  } else {
    go();
  }
})();

/* =========================================================
   Анимации при прокрутке
   ========================================================= */
const header = $("#header");
const hero = $(".hero");
const panels = $$(".panel");
const aboutText = $("#aboutText");

// Текст «О нас» разбиваем на слова — они загораются по мере прокрутки
const fullText = aboutText.textContent.trim();
const wordList = fullText.split(/\s+/);
aboutText.setAttribute("aria-label", fullText);
aboutText.innerHTML = wordList.map((w) => `<span class="w" aria-hidden="true">${w}</span>`).join(" ");
const wordEls = $$(".w", aboutText);
let litCount = 0;

function updateWords() {
  const vh = innerHeight;
  const r = aboutText.getBoundingClientRect();
  const p = clamp((vh * 0.85 - r.top) / (r.height + vh * 0.3), 0, 1);
  const count = Math.round(p * wordEls.length);
  if (count === litCount) return;
  wordEls.forEach((el, i) => el.classList.toggle("on", i < count));
  litCount = count;
}

// Карточки направлений слегка уменьшаются, когда их накрывает следующая
function updateStack() {
  panels.forEach((panel, i) => {
    const next = panels[i + 1];
    if (!next) return;
    const stickyTop = parseFloat(getComputedStyle(panel).top) || 0;
    const gap = next.getBoundingClientRect().top - stickyTop;
    const overlap = clamp(1 - gap / panel.offsetHeight, 0, 1);
    panel.style.transform = `scale(${(1 - overlap * 0.05).toFixed(4)})`;
  });
}

function update() {
  const y = scrollY;
  header.classList.toggle("is-scrolled", y > 40);
  hero.style.setProperty("--hp", clamp(y / hero.offsetHeight, 0, 1).toFixed(4));
  if (reduceMotion) return;
  updateWords();
  updateStack();
}

let ticking = false;
function onScroll() {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(() => { update(); ticking = false; });
}
addEventListener("scroll", onScroll, { passive: true });
addEventListener("resize", onScroll);
update();

if (reduceMotion) wordEls.forEach((el) => el.classList.add("on"));

// Плавное появление блоков
const io = new IntersectionObserver((entries) => {
  entries.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
  });
}, { threshold: 0.25 });
$$("[data-reveal]").forEach((el) => io.observe(el));

/* =========================================================
   Меню на телефоне
   ========================================================= */
const burger = $("#burger");
const nav = $("#nav");
function setMenu(open) {
  nav.classList.toggle("open", open);
  header.classList.toggle("menu-open", open);
  burger.setAttribute("aria-expanded", String(open));
  burger.setAttribute("aria-label", open ? "Закрыть меню" : "Открыть меню");
}
burger.addEventListener("click", () => setMenu(!nav.classList.contains("open")));
nav.addEventListener("click", (e) => { if (e.target.closest("a")) setMenu(false); });
addEventListener("keydown", (e) => { if (e.key === "Escape") setMenu(false); });
matchMedia("(min-width: 861px)").addEventListener("change", () => setMenu(false));

/* =========================================================
   Ссылки на Казбэк Learn
   ========================================================= */
["#learnLink", "#learnLinkFooter"].forEach((sel) => {
  const a = $(sel);
  if (learnUrl()) {
    a.href = learnUrl();
  } else {
    a.addEventListener("click", (e) => { e.preventDefault(); toast("Казбэк Learn скоро откроется"); });
  }
});

$("#year").textContent = new Date().getFullYear();

/* =========================================================
   Окна
   ========================================================= */
const authModal = $("#authModal");
const cabinetModal = $("#cabinetModal");

function openModal(modal) {
  setMenu(false);
  if (!modal.open) modal.showModal();
}
function closeModal(modal) {
  if (!modal.open) return;
  modal.classList.add("is-closing");
  setTimeout(() => { modal.close(); modal.classList.remove("is-closing"); }, 200);
}
[authModal, cabinetModal].forEach((m) => {
  m.addEventListener("click", (e) => { if (e.target === m) closeModal(m); });
});

/* ---------- Формы: общие помощники ---------- */
const authStatus = $("#authStatus");
function showStatus(message, type) {
  authStatus.textContent = message || "";
  authStatus.className = "form-status" + (message ? (type === "ok" ? " is-ok" : " is-error") : "");
}
function setError(input, message) {
  const field = input.closest(".field");
  field.classList.add("field--error");
  field.querySelector(".field__error").textContent = message;
  input.setAttribute("aria-invalid", "true");
}
function clearError(input) {
  const field = input.closest(".field");
  if (!field) return;
  field.classList.remove("field--error");
  field.querySelector(".field__error").textContent = "";
  input.removeAttribute("aria-invalid");
}
function clearForm(form) { $$("input", form).forEach(clearError); }
function busy(btn, on) { btn.classList.toggle("is-busy", on); btn.setAttribute("aria-busy", String(on)); }

document.addEventListener("input", (e) => {
  if (e.target.matches(".field input")) { clearError(e.target); showStatus(""); }
});
document.addEventListener("change", (e) => {
  if (e.target.matches(".field input[type=checkbox]")) clearError(e.target);
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/* ---------- Вход / регистрация / сброс ---------- */
const TITLES = { login: "Вход в аккаунт", register: "Создание аккаунта", reset: "Восстановление пароля" };
const tabsEl = $("#authTabs");

function setView(view) {
  $$("[data-view]").forEach((f) => { f.hidden = f.dataset.view !== view; });
  $$("[data-tab]", tabsEl).forEach((t) => t.setAttribute("aria-selected", String(t.dataset.tab === view)));
  tabsEl.hidden = view === "reset";
  $("#authTitle").textContent = TITLES[view];
  showStatus("");
  $$("form", authModal).forEach(clearForm);
}

function openAuth(view = "login") {
  setView(view);
  $("#configNotice").hidden = isConfigured;
  openModal(authModal);
  setTimeout(() => {
    const first = $(`[data-view="${view}"] input`);
    if (first) first.focus();
  }, 80);
}

document.addEventListener("click", (e) => {
  const authBtn = e.target.closest("[data-auth]");
  if (authBtn) { openAuth(authBtn.dataset.auth); return; }

  const cab = e.target.closest("[data-open-cabinet]");
  if (cab) { openModal(cabinetModal); refreshLearnStatus(); return; }

  const close = e.target.closest("[data-close]");
  if (close) { closeModal(close.closest("dialog")); return; }

  const tab = e.target.closest("[data-tab]");
  if (tab) { setView(tab.dataset.tab); return; }

  const go = e.target.closest("[data-go]");
  if (go) { setView(go.dataset.go); return; }

  const pw = e.target.closest("[data-pw-toggle]");
  if (pw) {
    const input = pw.parentElement.querySelector("input");
    const show = input.type === "password";
    input.type = show ? "text" : "password";
    pw.textContent = show ? "Скрыть" : "Показать";
    pw.setAttribute("aria-label", show ? "Скрыть пароль" : "Показать пароль");
  }
});

// Индикатор надёжности пароля
const pwInput = $("#regPassword");
const meter = $("#pwMeter");
const pwHint = $("#pwHint");
const HINTS = ["Используйте буквы разного регистра, цифры и символы", "Слишком простой пароль", "Можно надёжнее: добавьте заглавные буквы и цифры", "Хороший пароль", "Отличный пароль"];
function passwordScore(v) {
  if (!v) return 0;
  let s = 0;
  if (v.length >= 8) s++;
  if (/\p{Ll}/u.test(v) && /\p{Lu}/u.test(v)) s++;
  if (/\d/.test(v)) s++;
  if (/[^\p{L}\d]/u.test(v) || v.length >= 12) s++;
  return v.length < 8 ? Math.min(s, 1) : Math.max(s, 1);
}
pwHint.textContent = HINTS[0];
pwInput.addEventListener("input", () => {
  const score = passwordScore(pwInput.value);
  meter.dataset.score = score;
  pwHint.textContent = HINTS[score];
});

// Вход
const loginForm = $("#loginForm");
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = $("[type=submit]", loginForm);
  if (btn.classList.contains("is-busy")) return;
  clearForm(loginForm); showStatus("");

  const email = loginForm.email.value.trim();
  const password = loginForm.password.value;
  let ok = true;
  if (!EMAIL_RE.test(email)) { setError(loginForm.email, "Введите адрес почты, например name@example.com"); ok = false; }
  if (!password) { setError(loginForm.password, "Введите пароль"); ok = false; }
  if (!ok) { $(".field--error input", loginForm)?.focus(); return; }

  busy(btn, true);
  try {
    await login(email, password);
    loginForm.reset();
    closeModal(authModal);
    toast("Вы вошли в аккаунт");
  } catch (err) {
    showStatus(humanError(err), "error");
  } finally {
    busy(btn, false);
  }
});

// Регистрация
const registerForm = $("#registerForm");
registerForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = $("[type=submit]", registerForm);
  if (btn.classList.contains("is-busy")) return;
  clearForm(registerForm); showStatus("");

  const name = registerForm.name.value.trim();
  const email = registerForm.email.value.trim();
  const password = registerForm.password.value;
  const password2 = registerForm.password2.value;
  let ok = true;
  if (name.length < 2) { setError(registerForm.name, "Укажите имя — не короче двух символов"); ok = false; }
  if (!EMAIL_RE.test(email)) { setError(registerForm.email, "Введите адрес почты, например name@example.com"); ok = false; }
  if (password.length < 8) { setError(registerForm.password, "Пароль должен быть не короче 8 символов"); ok = false; }
  if (password2 !== password) { setError(registerForm.password2, "Пароли не совпадают"); ok = false; }
  if (!registerForm.agree.checked) { setError(registerForm.agree, "Нужно согласие, чтобы создать аккаунт"); ok = false; }
  if (!ok) { $(".field--error input", registerForm)?.focus(); return; }

  busy(btn, true);
  try {
    await register({ name, email, password });
    registerForm.reset();
    meter.dataset.score = 0;
    pwHint.textContent = HINTS[0];
    closeModal(authModal);
    toast("Аккаунт создан. Мы отправили письмо для подтверждения почты");
  } catch (err) {
    showStatus(humanError(err), "error");
  } finally {
    busy(btn, false);
  }
});

// Сброс пароля
const resetForm = $("#resetForm");
resetForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = $("[type=submit]", resetForm);
  if (btn.classList.contains("is-busy")) return;
  clearForm(resetForm); showStatus("");

  const email = resetForm.email.value.trim();
  if (!EMAIL_RE.test(email)) { setError(resetForm.email, "Введите адрес почты, например name@example.com"); resetForm.email.focus(); return; }

  busy(btn, true);
  try {
    await resetPassword(email);
    showStatus("Если аккаунт с такой почтой есть, мы отправили на неё ссылку для нового пароля.", "ok");
  } catch (err) {
    showStatus(humanError(err), "error");
  } finally {
    busy(btn, false);
  }
});

// Google
$$("[data-google]").forEach((btn) => {
  btn.addEventListener("click", async () => {
    if (btn.classList.contains("is-busy")) return;
    showStatus("");
    busy(btn, true);
    try {
      await loginWithGoogle();
      closeModal(authModal);
      toast("Вы вошли через Google");
    } catch (err) {
      if (!isSilentError(err)) showStatus(humanError(err), "error");
    } finally {
      busy(btn, false);
    }
  });
});

/* =========================================================
   Личный кабинет
   ========================================================= */
const profileForm = $("#profileForm");
const learnBtn = $("#learnLinkBtn");
const learnBadge = $("#learnBadge");
let state = { user: null, profile: null };

profileForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = $("[type=submit]", profileForm);
  if (btn.classList.contains("is-busy")) return;
  clearForm(profileForm);
  const name = profileForm.name.value.trim();
  if (name.length < 2) { setError(profileForm.name, "Укажите имя — не короче двух символов"); profileForm.name.focus(); return; }

  busy(btn, true);
  try {
    await updateName(name);
    renderAuth();
    toast("Изменения сохранены");
  } catch (err) {
    toast(humanError(err));
  } finally {
    busy(btn, false);
  }
});

$("#logoutBtn").addEventListener("click", async () => {
  try {
    await logout();
    closeModal(cabinetModal);
    toast("Вы вышли из аккаунта");
  } catch (err) {
    toast(humanError(err));
  }
});

$("#resendBtn").addEventListener("click", async () => {
  try {
    await resendVerification();
    toast("Письмо отправлено. Проверьте почту");
  } catch (err) {
    toast(err?.code === "auth/too-many-requests" ? humanError(err) : "Не удалось отправить письмо. Попробуйте позже.");
  }
});

const learnForm = $("#learnLinkForm");
const learnUnlink = $("#learnUnlinkBtn");
let learnLinked = false;

function renderLearn() {
  learnBadge.textContent = learnLinked ? "Аккаунт привязан" : "Не привязан";
  learnBadge.classList.toggle("is-ok", learnLinked);
  learnBtn.textContent = learnLinked ? "Открыть Казбэк Learn" : "Привязать аккаунт";
  learnUnlink.hidden = !learnLinked;
  if (learnLinked) learnForm.hidden = true;
}
async function refreshLearnStatus() {
  try { learnLinked = (await learnStatus()).linked; } catch (e) { learnLinked = false; }
  renderLearn();
}

learnBtn.addEventListener("click", async () => {
  if (learnBtn.classList.contains("is-busy")) return;
  if (learnLinked) {
    busy(learnBtn, true);
    try { await openLearn(); } catch (err) { toast(humanError(err)); } finally { busy(learnBtn, false); }
    return;
  }
  learnForm.hidden = !learnForm.hidden;
  if (!learnForm.hidden) $("#learnEmail").focus();
});

learnForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = $("[type=submit]", learnForm);
  if (btn.classList.contains("is-busy")) return;
  clearForm(learnForm);
  const email = $("#learnEmail").value.trim();
  const password = $("#learnPassword").value;
  let ok = true;
  if (!EMAIL_RE.test(email)) { setError($("#learnEmail"), "Введите почту от Казбэк Learn"); ok = false; }
  if (!password) { setError($("#learnPassword"), "Введите пароль"); ok = false; }
  if (!ok) return;
  busy(btn, true);
  try {
    await linkLearn(email, password);
    learnForm.reset();
    learnLinked = true;
    renderLearn();
    toast("Аккаунт Казбэк Learn привязан");
  } catch (err) {
    toast(humanError(err));
  } finally {
    busy(btn, false);
  }
});

learnUnlink.addEventListener("click", async () => {
  if (!confirm("Отвязать аккаунт Казбэк Learn?")) return;
  try { await unlinkLearn(); learnLinked = false; renderLearn(); toast("Аккаунт отвязан"); }
  catch (err) { toast(humanError(err)); }
});

/* =========================================================
   Отрисовка по состоянию входа
   ========================================================= */
function displayName(user) {
  return user.displayName || (user.email ? user.email.split("@")[0] : "Участник");
}

function userChip() {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "user-chip";
  btn.setAttribute("data-open-cabinet", "");
  btn.setAttribute("aria-label", "Открыть личный кабинет");
  const av = document.createElement("span");
  av.className = "avatar";
  av.textContent = displayName(state.user).charAt(0).toUpperCase();
  const nm = document.createElement("span");
  nm.className = "user-chip__name";
  nm.textContent = displayName(state.user);
  btn.append(av, nm);
  return btn;
}

const guestHeaderHTML = $("#authActions").innerHTML;
const guestMobileHTML = $("#navAuthMobile").innerHTML;
const guestJoinHTML = $("#joinActions").innerHTML;
const guestJoinTitle = $("#joinTitle").textContent;
const guestJoinLead = $("#joinLead").textContent;

function renderAuth() {
  const user = state.user;
  const actions = $("#authActions");
  const mobile = $("#navAuthMobile");
  const joinActions = $("#joinActions");

  if (user) {
    actions.replaceChildren(userChip());
    const mobBtn = document.createElement("button");
    mobBtn.type = "button";
    mobBtn.className = "btn btn--primary";
    mobBtn.setAttribute("data-open-cabinet", "");
    mobBtn.textContent = "Личный кабинет";
    mobile.replaceChildren(mobBtn);

    $("#joinTitle").textContent = `Здравствуйте, ${displayName(user)}!`;
    $("#joinLead").textContent = "Ваш аккаунт Казбэк создан. В личном кабинете можно изменить профиль и привязать аккаунт Казбэк Learn.";
    const open = document.createElement("button");
    open.type = "button";
    open.className = "btn btn--light btn--lg";
    open.setAttribute("data-open-cabinet", "");
    open.textContent = "Открыть кабинет";
    joinActions.replaceChildren(open);

    $$("[data-guest-only]").forEach((el) => { el.hidden = true; });
  } else {
    actions.innerHTML = guestHeaderHTML;
    mobile.innerHTML = guestMobileHTML;
    joinActions.innerHTML = guestJoinHTML;
    $("#joinTitle").textContent = guestJoinTitle;
    $("#joinLead").textContent = guestJoinLead;
    $$("[data-guest-only]").forEach((el) => { el.hidden = false; });
    if (cabinetModal.open) closeModal(cabinetModal);
  }
  renderCabinet();
}

function renderCabinet() {
  const user = state.user;
  if (!user) return;
  $("#cabAvatar").textContent = displayName(user).charAt(0).toUpperCase();
  $("#cabEmail").textContent = user.email || "";
  $("#cabVerify").hidden = user.emailVerified;
  if (document.activeElement !== profileForm.name) profileForm.name.value = user.displayName || "";

  renderLearn();
}

watchAuth(async (user) => {
  state = { user, profile: null };
  renderAuth();
  if (user) {
    state.profile = await getProfile(user.uid);
    renderCabinet();
  }
});
