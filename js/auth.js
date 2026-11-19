import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signInWithPopup, GoogleAuthProvider, sendPasswordResetEmail, sendEmailVerification,
  updateProfile, signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig, KAZBEK_LEARN } from "./firebase-config.js";

export const isConfigured =
  Boolean(firebaseConfig.apiKey) && !/^YOUR_/i.test(firebaseConfig.apiKey);

let auth = null;
let db = null;

if (isConfigured) {
  const app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  auth.languageCode = "ru";
  db = getFirestore(app);
}

function requireFirebase() {
  if (!isConfigured) {
    const err = new Error("Firebase не настроен");
    err.code = "kazbek/not-configured";
    throw err;
  }
}

/* ---------- Сообщения об ошибках на русском ---------- */
const MESSAGES = {
  "kazbek/not-configured": "Firebase ещё не подключён. Добавьте ключи проекта в firebase-config.js.",
  "kazbek/learn-not-configured": "Привязка заработает после подключения Казбэк Learn (firebase-config.js).",
  "kazbek/learn-failed": "Не удалось привязать Казбэк Learn. Попробуйте позже.",
  "kazbek/learn-bad-credentials": "Неверная почта или пароль от Казбэк Learn.",
  "kazbek/learn-already-linked": "Этот аккаунт Learn уже привязан к другому аккаунту Казбэк.",
  "auth/invalid-email": "Проверьте адрес почты — он указан неверно.",
  "auth/user-not-found": "Аккаунт с такой почтой не найден.",
  "auth/wrong-password": "Неверный пароль. Попробуйте ещё раз или восстановите пароль.",
  "auth/invalid-credential": "Неверная почта или пароль.",
  "auth/invalid-login-credentials": "Неверная почта или пароль.",
  "auth/email-already-in-use": "Аккаунт с такой почтой уже есть. Войдите или восстановите пароль.",
  "auth/weak-password": "Пароль слишком простой. Используйте не меньше 8 символов.",
  "auth/too-many-requests": "Слишком много попыток. Подождите немного и повторите.",
  "auth/network-request-failed": "Нет связи с сервером. Проверьте интернет.",
  "auth/popup-closed-by-user": "Окно входа закрыто до завершения.",
  "auth/cancelled-popup-request": "Окно входа закрыто до завершения.",
  "auth/popup-blocked": "Браузер заблокировал окно Google. Разрешите всплывающие окна.",
  "auth/user-disabled": "Этот аккаунт заблокирован.",
  "auth/operation-not-allowed": "Этот способ входа не включён в Firebase Console.",
  "auth/unauthorized-domain": "Домен сайта не добавлен в Authorized domains в Firebase Console.",
  "auth/requires-recent-login": "Для этого действия войдите заново."
};

export function humanError(err) {
  return MESSAGES[err?.code] || "Не удалось выполнить действие. Попробуйте ещё раз.";
}

export function isSilentError(err) {
  return err?.code === "auth/popup-closed-by-user" || err?.code === "auth/cancelled-popup-request";
}

/* ---------- Профиль в Firestore ---------- */
async function ensureUserDoc(user, extra = {}) {
  try {
    const ref = doc(db, "users", user.uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        displayName: user.displayName || extra.displayName || "",
        email: user.email || "",
        createdAt: serverTimestamp(),
        services: { learn: { linked: false } }
      });
    }
  } catch (e) {
    // Правила Firestore могут быть ещё не настроены — вход при этом не ломаем.
    console.warn("Не удалось создать профиль в Firestore:", e);
  }
}

export async function getProfile(uid) {
  if (!isConfigured) return null;
  try {
    const snap = await getDoc(doc(db, "users", uid));
    return snap.exists() ? snap.data() : null;
  } catch (e) {
    console.warn("Не удалось прочитать профиль:", e);
    return null;
  }
}

/* ---------- Состояние входа ---------- */
export function watchAuth(callback) {
  if (!isConfigured) {
    callback(null);
    return () => {};
  }
  return onAuthStateChanged(auth, callback);
}

export function currentUser() {
  return auth?.currentUser || null;
}

/* ---------- Действия ---------- */
export async function register({ name, email, password }) {
  requireFirebase();
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(cred.user, { displayName: name });
  await ensureUserDoc(cred.user, { displayName: name });
  sendEmailVerification(cred.user).catch(() => {});
  return cred.user;
}

export async function login(email, password) {
  requireFirebase();
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

export async function loginWithGoogle() {
  requireFirebase();
  const cred = await signInWithPopup(auth, new GoogleAuthProvider());
  await ensureUserDoc(cred.user);
  return cred.user;
}

export async function resetPassword(email) {
  requireFirebase();
  await sendPasswordResetEmail(auth, email);
}

export async function logout() {
  requireFirebase();
  await signOut(auth);
}

export async function updateName(name) {
  requireFirebase();
  const user = auth.currentUser;
  await updateProfile(user, { displayName: name });
  try {
    await setDoc(doc(db, "users", user.uid), { displayName: name }, { merge: true });
  } catch (e) {
    console.warn("Не удалось обновить имя в Firestore:", e);
  }
  return user;
}

export async function resendVerification() {
  requireFirebase();
  await sendEmailVerification(auth.currentUser);
}

/* ---------- Привязка Казбэк Learn ----------
   Схема: сайт Казбэк отправляет свой ID-токен в Cloud Function Казбэк Learn.
   Функция проверяет токен (verifyIdToken по projectId проекта «Казбэк»),
   создаёт запись связи в Firebase Казбэк Learn и возвращает customToken.
   Казбэк Learn входит через signInWithCustomToken(customToken). */
export function learnUrl() {
  return KAZBEK_LEARN.url || "";
}

async function learnCall(action, extra = {}) {
  requireFirebase();
  if (!KAZBEK_LEARN.linkEndpoint) {
    const err = new Error("not configured");
    err.code = "kazbek/learn-not-configured";
    throw err;
  }
  const idToken = await auth.currentUser.getIdToken();
  let res;
  try {
    res = await fetch(KAZBEK_LEARN.linkEndpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${idToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...extra })
    });
  } catch (e) {
    const err = new Error("network");
    err.code = "auth/network-request-failed";
    throw err;
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || "failed");
    err.code = data.error === "bad_credentials" ? "kazbek/learn-bad-credentials"
             : data.error === "already_linked" ? "kazbek/learn-already-linked"
             : "kazbek/learn-failed";
    throw err;
  }
  return data;
}

export const learnStatus = () => learnCall("status");
export const linkLearn = (email, password) => learnCall("link", { email, password });
export const unlinkLearn = () => learnCall("unlink");

export async function openLearn() {
  const base = learnUrl();
  const w = window.open("about:blank", "_blank"); // открываем сразу, чтобы браузер не заблокировал
  try {
    const { customToken } = await learnCall("open");
    const url = `${base}#kazbekToken=${encodeURIComponent(customToken)}`;
    if (w) w.location.href = url; else location.href = url;
  } catch (e) {
    if (w) w.close();
    throw e;
  }
}