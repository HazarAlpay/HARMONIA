// Buradaki bilgiler demo süreci için. Üretim ortamında backend'e aktarılmalıdır.
export const CLIENT_ID = "e03215f0b57e486bbedb03f4cd80a768";
export const CLIENT_SECRET = "ef77784e3ce64770b2618e12300ed5a3";
export const REDIRECT_URI = "exp://172.20.10.2:8081"; // Geliştirme sırasında kullanılması gereken URI, üretimde değiştirilmelidir
export const AUTH_URL = "https://accounts.spotify.com/authorize";
export const TOKEN_URL = "https://accounts.spotify.com/api/token";
export const SCOPES = "user-library-read playlist-read-private user-top-read";
