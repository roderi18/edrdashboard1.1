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
      // Si se pulsó la estrella mientras llegaba esta lectura, lo pulsado es
      // más nuevo: antes la lectura vieja lo pisaba y parecía que el clic no
      // había hecho nada (había que pulsar dos veces).
      const local = readCachedFavorites(memberId)?.[String(itemId)];
      const localMasNuevo =
        local?.actualizadoEn &&
        (!remote?.actualizadoEn || String(local.actualizadoEn) > String(remote.actualizadoEn));

      if (remote && !localMasNuevo) {
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
      // Sin `preventDefault`: en el cambio de una casilla hace que el navegador
      // deshaga el clic después de que React la marque, y la estrella pedía
      // dos pulsaciones. `stopPropagation` basta para no abrir el panel.
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
