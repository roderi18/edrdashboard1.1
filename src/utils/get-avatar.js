export function getAvatarById(id, type = 'member') {
    const MAX_AVATARS = 24; // cantidad real en tu carpeta

    const rawIndex = parseInt(id.split('-')[1], 10) || 1;

    const avatarIndex = ((rawIndex - 1) % MAX_AVATARS) + 1;

    return `/assets/images/avatars/avatar-${avatarIndex}.jpg`;
}