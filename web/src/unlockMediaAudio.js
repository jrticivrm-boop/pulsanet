/**
 * Desbloqueo unificado de audio web (gesto de usuario).
 * Safari/Chrome bloquean autoplay hasta un pointer/keydown; PTT, panic y ringtone
 * dependen de esto. No sustituye FGS del APK: en móvil web hay que mantener la pestaña abierta.
 */
import { unlockPanicAudio } from './panicSound';
import { unlockAppNotifyAudio } from './appNotify';

/**
 * @param {(() => Promise<unknown>|unknown)|null} [extra] p. ej. ptt.unlockAudio
 */
export async function unlockMediaAudio(extra = null) {
  const jobs = [unlockPanicAudio(), unlockAppNotifyAudio()];
  if (typeof extra === 'function') {
    try {
      jobs.push(Promise.resolve(extra()));
    } catch {
      /* ignore sync throw */
    }
  }
  await Promise.allSettled(jobs);
}
