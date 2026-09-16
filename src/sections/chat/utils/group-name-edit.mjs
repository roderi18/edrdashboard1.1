export const resolveGroupNameEdit = (currentName, draftName) => {
  const current = String(currentName || '').trim();
  const next = String(draftName || '').trim();

  return {
    name: next || current,
    shouldSave: Boolean(next && next !== current),
  };
};
