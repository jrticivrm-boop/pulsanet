/**
 * Errores de PostgreSQL / inserts de chat → texto usable para el operador.
 */
export function friendlyMessageDbError(err, fallback = 'No se pudo enviar el mensaje') {
  const raw = String(err?.message || err || '').trim();
  if (!raw) return fallback;
  if (
    /messages_target|viola la restricci[oó]n.*messages_target|violates check constraint ["']?messages_target/i.test(
      raw
    )
  ) {
    return 'No se pudo guardar el mensaje (destino inválido). Cierra el chat, ábrelo de nuevo e intenta otra vez.';
  }
  if (/invalid input syntax for type uuid/i.test(raw)) {
    return 'Identificador de chat inválido. Abre el hilo de nuevo.';
  }
  if (/foreign key|violates foreign key/i.test(raw)) {
    return 'El chat o el usuario ya no existe.';
  }
  // Errores que ya vienen en español amigable
  if (
    /[áéíóúñ¿¡]/i.test(raw) ||
    /^(no |sin |mensaje|usuario|canal|máximo|sticker)/i.test(raw)
  ) {
    return raw;
  }
  return fallback;
}
