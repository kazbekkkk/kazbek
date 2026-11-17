// =========================================================
// Firebase проекта «Казбек» (главный сайт МДМЦ).
// Firebase Console → Project settings → Your apps → Web app → SDK setup.
// Пока значения начинаются с YOUR_, сайт работает без Firebase,
// а формы показывают подсказку о подключении.
// =========================================================
export const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// =========================================================
// Казбек Learn — подсервис.
// url          — адрес сайта Казбек Learn (ссылки в шапке, подвале и кабинете).
// linkEndpoint — адрес Cloud Function, которая проверяет ID-токен аккаунта Казбек
//                и возвращает { customToken } для входа в Firebase Казбек Learn.
//                Пока пусто — кнопка «Привязать аккаунт» показывает подсказку.
// =========================================================
export const KAZBEK_LEARN = {
  url: "",
  linkEndpoint: ""
};

/*
Правила Firestore для проекта «Казбек» (Firestore → Rules):

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