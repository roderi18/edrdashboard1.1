import { useMemo, useState, useEffect, useCallback } from 'react';

import {
  listarFavoritosAscensoMiembro,
  guardarFavoritoAscensoMiembro,
} from 'src/services/member-awards-service';

import { useAuthContext } from 'src/auth/hooks';

// ----------------------------------------------------------------------

const getStorageKey = (memberId) => `awards-favorites-${memberId}`;

const readLocalFavorites = (memberId) => {
  if (typeof window === 'undefined' || !memberId) return {};

  try {
    return JSON.parse(window.localStorage.getItem(getStorageKey(memberId)) || '{}');
  } catch {
    return {};
  }
};

const writeLocalFavorite = (memberId, itemId, payload) => {
  if (typeof window === 'undefined' || !memberId || !itemId) return;

  const current = readLocalFavorites(memberId);
  const next = { ...current, [String(itemId)]: payload };

  window.localStorage.setItem(getStorageKey(memberId), JSON.stringify(next));
  window.dispatchEvent(
    new CustomEvent('awards-favorites-changed', {
      detail: { memberId: String(memberId), itemId: String(itemId) },
    })
  );
};

export function useAwardFavorite({ memberId, item, initialValue = false, user } = {}) {
  const { user: authUser } = useAuthContext();
  const itemId = item?.id;
  const [favorited, setFavorited] = useState(Boolean(initialValue));

  const localFavorite = useMemo(() => {
    const stored = readLocalFavorites(memberId)?.[String(itemId)];

    return stored ? Boolean(stored.favorito) : null;
  }, [memberId, itemId]);

  useEffect(() => {
    if (!memberId || !itemId) {
      setFavorited(Boolean(initialValue));
      return undefined;
    }

    if (localFavorite !== null) {
      setFavorited(localFavorite);
    }

    let active = true;

    listarFavoritosAscensoMiembro(memberId).then((favorites) => {
      if (!active) return;

      const remote = favorites?.[String(itemId)];

      if (remote) {
        writeLocalFavorite(memberId, itemId, remote);
        setFavorited(Boolean(remote.favorito));
      }
    });

    const handleFavoritesChange = (event) => {
      if (event.detail?.memberId && String(event.detail.memberId) !== String(memberId)) return;

      const next = readLocalFavorites(memberId)?.[String(itemId)];
      setFavorited(next ? Boolean(next.favorito) : Boolean(initialValue));
    };

    window.addEventListener('awards-favorites-changed', handleFavoritesChange);
    window.addEventListener('storage', handleFavoritesChange);

    return () => {
      active = false;
      window.removeEventListener('awards-favorites-changed', handleFavoritesChange);
      window.removeEventListener('storage', handleFavoritesChange);
    };
  }, [initialValue, itemId, localFavorite, memberId]);

  const onToggleFavorite = useCallback(
    async (event) => {
      event?.preventDefault?.();
      event?.stopPropagation?.();

      if (!memberId || !itemId) {
        setFavorited((current) => !current);
        return;
      }

      const nextValue = !favorited;
      const payload = {
        favorito: nextValue,
        idItem: String(itemId),
        nombreItem: item?.name || '',
        tipoItem: item?.type || '',
        idPadre: item?.parentId || '',
        actualizadoEn: new Date().toISOString(),
      };

      setFavorited(nextValue);
      writeLocalFavorite(memberId, itemId, payload);

      try {
        await guardarFavoritoAscensoMiembro({
          idMiembro: memberId,
          itemId,
          favorito: nextValue,
          item,
          user: user || authUser,
        });
      } catch (error) {
        console.error('[Awards] No se pudo guardar favorito en Firebase.', error);
      }
    },
    [authUser, favorited, item, itemId, memberId, user]
  );

  return { favorited, onToggleFavorite };
}
