import { handlers } from "@/auth";

// Auth.js'in kendi uçları (csrf, session, callback, signout). Middleware
// matcher'ı bu yolu BİLEREK dışarıda bırakır; girerse yönlendirme döngüsü olur.
export const { GET, POST } = handlers;
