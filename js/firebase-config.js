// =========================================================
// Firebase проекта «Казбэк» (главный сайт МДМЦ).
// Firebase Console → Project settings → Your apps → Web app → SDK setup.
// Пока значения начинаются с YOUR_, сайт работает без Firebase,
// а формы показывают подсказку о подключении.
// =========================================================
export const firebaseConfig = {
  apiKey: "AIzaSyAhdJ0L_2t9yefWocuuBKlrQ90OEW4GXi0",
  authDomain: "kazbek-32d1c.firebaseapp.com",
  projectId: "kazbek-32d1c",
  storageBucket: "kazbek-32d1c.firebasestorage.app",
  messagingSenderId: "1038921559497",
  appId: "1:1038921559497:web:7f0f097e691bab225a8c18"
};

// =========================================================
// Казбэк Learn — подсервис.
// url          — адрес сайта Казбэк Learn (ссылки в шапке, подвале и кабинете).
// linkEndpoint — адрес Cloud Function, которая проверяет ID-токен аккаунта Казбэк
//                и возвращает { customToken } для входа в Firebase Казбэк Learn.
//                Пока пусто — кнопка «Привязать аккаунт» показывает подсказку.
// =========================================================
export const KAZBEK_LEARN = {
  url: "",
  linkEndpoint: ""
};

/*
Правила Firestore для проекта «Казбэк» (Firestore → Rules):

rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid} {
      allow read: if request.auth != null && request.auth.uid == uid;
      allow create: if request.auth != null && request.auth.uid == uid;
      // Менять displayName можно самому, а статус привязки Learn — только сервер.
      allow update: if request.auth != null && request.auth.uid == uid
        && !request.resource.data.diff(resource.data).affectedKeys().hasAny(['services']);
    }
  }
}

Authentication → Sign-in method: включите «Электронная почта/пароль» и «Google».
Authentication → Settings → Authorized domains: добавьте домен сайта (например, ваш.github.io).
*/
