/** Maps Supabase auth errors to user-friendly Portuguese messages. */
export function authErrorMessage(error: { message: string; code?: string }): string {
  const msg = error.message.toLowerCase();

  if (error.code === "email_not_confirmed" || msg.includes("email not confirmed")) {
    return "Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada.";
  }
  if (msg.includes("invalid login credentials") || msg.includes("invalid_credentials")) {
    return "E-mail ou senha incorretos.";
  }
  if (msg.includes("user already registered") || msg.includes("already been registered")) {
    return "Este e-mail já está cadastrado. Tente entrar.";
  }
  if (msg.includes("password") && msg.includes("at least")) {
    return "A senha deve ter pelo menos 6 caracteres.";
  }
  if (msg.includes("rate limit") || msg.includes("too many requests")) {
    return "Muitas tentativas. Aguarde um momento e tente novamente.";
  }
  if (
    msg.includes("missing oauth secret") ||
    msg.includes("unsupported provider") ||
    msg.includes("validation_failed")
  ) {
    return "Login com Google não está configurado. Use e-mail e senha ou configure o Google OAuth no painel Supabase.";
  }

  return error.message;
}
