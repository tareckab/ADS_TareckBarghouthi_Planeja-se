import { useCallback, useState } from 'react';

export const AVATAR_SIZE = 256;
const MAX_FILE_BYTES = 8 * 1024 * 1024;

export type Profile = { nickname: string; photo: string };
const emptyProfile: Profile = { nickname: '', photo: '' };

const storageKey = (email: string) => `${PROFILE_PREFIX}${email.toLowerCase()}`;

const PROFILE_PREFIX = 'planeja-se-profile:';

/** Remove do navegador os perfis (apelido e foto) guardados por e-mail. */
export function clearProfiles() {
  try {
    const keys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (key?.startsWith(PROFILE_PREFIX)) keys.push(key);
    }
    keys.forEach((key) => window.localStorage.removeItem(key));
  } catch {
    // Armazenamento indisponível: nada a limpar.
  }
}

function readProfile(email: string): Profile {
  if (!email) return emptyProfile;
  try {
    const raw = window.localStorage.getItem(storageKey(email));
    if (!raw) return emptyProfile;
    const parsed = JSON.parse(raw) as Partial<Profile>;
    return {
      nickname: typeof parsed.nickname === 'string' ? parsed.nickname : '',
      photo: typeof parsed.photo === 'string' && parsed.photo.startsWith('data:image/') ? parsed.photo : '',
    };
  } catch {
    return emptyProfile;
  }
}

/** Perfil do usuário (apelido e foto), guardado neste navegador por e-mail. */
export function useProfile(email: string) {
  const [state, setState] = useState(() => ({ email, profile: readProfile(email) }));
  // E-mail mudou (login/logout): recarrega o perfil durante a renderização.
  if (state.email !== email) setState({ email, profile: readProfile(email) });
  const profile = state.email === email ? state.profile : readProfile(email);

  const save = useCallback(
    (next: Profile) => {
      setState({ email, profile: next });
      try {
        window.localStorage.setItem(storageKey(email), JSON.stringify(next));
        return true;
      } catch {
        return false;
      }
    },
    [email],
  );

  return { profile, save };
}

/** Recorta a imagem ao centro e a reduz para um quadrado padrão de 256 × 256 px (JPEG). */
export async function processAvatar(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Escolha um arquivo de imagem (JPG, PNG ou WebP).');
  if (file.size > MAX_FILE_BYTES) throw new Error('A imagem é grande demais. Use um arquivo de até 8 MB.');

  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error('Não foi possível ler essa imagem.'));
      element.src = url;
    });
    const side = Math.min(image.naturalWidth, image.naturalHeight);
    const canvas = document.createElement('canvas');
    canvas.width = AVATAR_SIZE;
    canvas.height = AVATAR_SIZE;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Seu navegador não conseguiu processar a imagem.');
    context.fillStyle = '#fff';
    context.fillRect(0, 0, AVATAR_SIZE, AVATAR_SIZE);
    context.drawImage(
      image,
      (image.naturalWidth - side) / 2,
      (image.naturalHeight - side) / 2,
      side,
      side,
      0,
      0,
      AVATAR_SIZE,
      AVATAR_SIZE,
    );
    return canvas.toDataURL('image/jpeg', 0.88);
  } finally {
    URL.revokeObjectURL(url);
  }
}
