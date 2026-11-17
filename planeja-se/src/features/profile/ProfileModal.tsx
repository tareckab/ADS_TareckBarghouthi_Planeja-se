import { useRef, useState } from 'react';
import { Camera, LogOut, Trash2 } from 'lucide-react';
import { ModalFrame } from '../../components/finance';
import { toTitleCase } from '../finance/model';
import { AVATAR_SIZE, processAvatar, type Profile } from './profile';

export function UserAvatar({ name, photo, className = '' }: { name: string; photo: string; className?: string }) {
  return (
    <span className={`user-avatar ${className}`.trim()} aria-hidden="true">
      {photo ? <img src={photo} alt="" width={AVATAR_SIZE} height={AVATAR_SIZE} /> : name[0]?.toUpperCase()}
    </span>
  );
}

export function ProfileModal({
  name,
  email,
  profile,
  onClose,
  onSave,
  onSignOut,
}: {
  name: string;
  email: string;
  profile: Profile;
  onClose: () => void;
  onSave: (profile: Profile) => boolean;
  onSignOut: () => void;
}) {
  const [nickname, setNickname] = useState(profile.nickname);
  const [photo, setPhoto] = useState(profile.photo);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const pickPhoto = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      setPhoto(await processAvatar(file));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível usar essa imagem.');
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  return (
    <ModalFrame title="Seu perfil" description="Personalize como você aparece no Planeja-se." onClose={onClose}>
      <form
        className="form-body profile-form"
        onSubmit={(e) => {
          e.preventDefault();
          const saved = onSave({ nickname: toTitleCase(nickname), photo });
          if (!saved) setError('Não foi possível guardar neste navegador. Tente uma foto menor.');
        }}
      >
        <div className="profile-photo">
          <UserAvatar name={nickname.trim() || name} photo={photo} className="profile-avatar" />
          <div className="profile-photo-actions">
            <input
              ref={fileInput}
              id="profile-photo-input"
              type="file"
              accept="image/*"
              onChange={(e) => void pickPhoto(e.target.files?.[0])}
            />
            <button type="button" className="profile-action" disabled={busy} onClick={() => fileInput.current?.click()}>
              <Camera size={15} /> {photo ? 'Alterar foto' : 'Adicionar foto'}
            </button>
            {photo && (
              <button type="button" className="profile-action danger" onClick={() => setPhoto('')}>
                <Trash2 size={15} /> Remover
              </button>
            )}
            <small>
              Qualquer imagem é recortada ao centro em {AVATAR_SIZE} × {AVATAR_SIZE} px.
            </small>
          </div>
        </div>
        {error && (
          <p className="profile-error" role="alert">
            {error}
          </p>
        )}
        <label className="form-label">
          Apelido
          <input
            autoFocus
            maxLength={30}
            placeholder="Como você gosta de ser chamado?"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
          />
        </label>
        <div className="form-grid">
          <label className="form-label">
            Nome
            <input value={name} readOnly tabIndex={-1} />
          </label>
          <label className="form-label">
            E-mail
            <input value={email} readOnly tabIndex={-1} />
          </label>
        </div>
        <div className="form-footer">
          <button type="button" className="profile-signout" onClick={onSignOut}>
            <LogOut size={15} /> Sair da conta
          </button>
          <button className="button-primary" disabled={busy}>
            Salvar perfil
          </button>
        </div>
      </form>
    </ModalFrame>
  );
}
