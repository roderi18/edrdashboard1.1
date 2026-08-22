const getReviewValue = (review) =>
  typeof review === 'boolean' ? review : review?.validada === true;

export const isCombinationCapabilityValidated = (document = {}, capabilityId = '') =>
  getReviewValue(document?.revisionesCapacidades?.[capabilityId]);

export const countValidatedCombinationCapabilities = (document = {}, capabilityIds = []) =>
  capabilityIds.filter((capabilityId) => isCombinationCapabilityValidated(document, capabilityId))
    .length;

export const mergeCombinationCapabilityReview = (document = {}, capabilityId = '', review = {}) => {
  if (!capabilityId) return document?.revisionesCapacidades ?? {};

  const previous = document?.revisionesCapacidades?.[capabilityId];

  return {
    ...(document?.revisionesCapacidades ?? {}),
    [capabilityId]: {
      ...(typeof previous === 'object' && previous ? previous : {}),
      ...review,
      validada: review?.validada === true,
    },
  };
};
