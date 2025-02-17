// Buradaki bilgiler demo süreci için. Üretim ortamında backend'e aktarılmalıdır.
export const CLIENT_ID = "bfbfbc53e0f84c83bdaa316d068b346d";
export const CLIENT_SECRET = "45d644cbb2e44f2ebbc1e8957b6a420e";
export const REDIRECT_URI = "exp://192.168.1.111:8081"; // Geliştirme sırasında kullanılması gereken URI, üretimde değiştirilmelidir
export const AUTH_URL = "https://accounts.spotify.com/authorize";
export const TOKEN_URL = "https://accounts.spotify.com/api/token";
export const SCOPES = "user-library-read playlist-read-private user-top-read";
