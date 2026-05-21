import { useMemo, useState, useEffect, useCallback } from 'react';

import {
  listarFavoritosAscensoMiembro,
  guardarFavoritoAscensoMiembro,
} from 'src/services/member-awards-service';

import { useAuthContext } from 'src/auth/hooks';

// ----------------------------------------------------------------------

const favoriteCache = new Map();

const readCachedFavorites = (memberId) =>
  memberId ? favoriteCache.get(String(memberId)) || {} : {};

const writeCachedFavorite = (memberId, itemId, payload) => {
  if (typeof window === 'undefined' || !memberId || !itemId) return;

  const current = readCachedFavorites(memberId);
  const next = { ...current, [String(itemId)]: payload };

  favoriteCache.set(String(memberId), next);
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

  const cachedFavorite = useMemo(() => {
    const stored = readCachedFavorites(memberId)?.[String(itemId)];

    return stored ? Boolean(stored.favorito) : null;
  }, [memberId, itemId]);

  useEffect(() => {
    if (!memberId || !itemId) {
      setFavorited(Boolean(initialValue));
      return undefined;
    }

    if (cachedFavorite !== null) {
      setFavorited(cachedFavorite);
    }

    let active = true;

    listarFavoritosAscensoMiembro(memberId).then((favorites) => {
      if (!active) return;

      const remote = favorites?.[String(itemId)];

      if (remote) {
        writeCachedFavorite(memberId, itemId, remote);
        setFavorited(Boolean(remote.favorito));
      }
    });

    const handleFavoritesChange = (event) => {
      if (event.detail?.memberId && String(event.detail.memberId) !== String(memberId)) return;

      const next = readCachedFavorites(memberId)?.[String(itemId)];
      setFavorited(next ? Boolean(next.favorito) : Boolean(initialValue));
    };

    window.addEventListener('awards-favorites-changed', handleFavoritesChange);

    return () => {
      active = false;
      window.removeEventListener('awards-favorites-changed', handleFavoritesChange);
    };
  }, [initialValue, itemId, cachedFavorite, memberId]);

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
      writeCachedFavorite(memberId, itemId, payload);

      try {
        await guardarFavoritoAscensoMiembro({
          idMiembro: memberId,
          itemId,
          favorito: nextValue,
          item,
          user: user || authUser,
        });
      } catch {
        // Keep the optimistic UI state; Firebase will be retried on the next user action.
      }
    },
    [authUser, favorited, item, itemId, memberId, user]
  );

  return { favorited, onToggleFavorite };
}
