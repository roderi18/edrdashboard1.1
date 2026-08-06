const normalizeText = (value) => String(value ?? '').trim();

const readJson = async (response) => {
  const text = await response.text();

  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

export const firestoreValueToJs = (value = {}) => {
  if ('nullValue' in value) return null;
  if ('booleanValue' in value) return value.booleanValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return Number(value.doubleValue);
  if ('timestampValue' in value) return value.timestampValue;
  if ('stringValue' in value) return value.stringValue;
  if ('referenceValue' in value) return value.referenceValue;
  if ('geoPointValue' in value) return value.geoPointValue;
  if ('bytesValue' in value) return value.bytesValue;
  if ('arrayValue' in value) {
    return (value.arrayValue?.values ?? []).map(firestoreValueToJs);
  }
  if ('mapValue' in value) {
    return firestoreFieldsToJs(value.mapValue?.fields ?? {});
  }

  return undefined;
};

export const firestoreFieldsToJs = (fields = {}) =>
  Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [key, firestoreValueToJs(value)])
  );

export const jsToFirestoreValue = (value) => {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') {
    return Number.isSafeInteger(value)
      ? { integerValue: String(value) }
      : { doubleValue: value };
  }
  if (typeof value === 'string') return { stringValue: value };
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map(jsToFirestoreValue) } };
  }
  if (typeof value === 'object') {
    return { mapValue: { fields: jsToFirestoreFields(value) } };
  }

  return { stringValue: String(value) };
};

export const jsToFirestoreFields = (data = {}) =>
  Object.fromEntries(
    Object.entries(data)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, jsToFirestoreValue(value)])
  );

export const firestoreDocumentToObject = (document = {}) => {
  const pathParts = String(document.name ?? '').split('/');
  const data = firestoreFieldsToJs(document.fields ?? {});

  Object.defineProperties(data, {
    id: { value: pathParts.at(-1) ?? '', enumerable: false },
    path: {
      value: pathParts.slice(pathParts.indexOf('documents') + 1).join('/'),
      enumerable: false,
    },
  });

  return data;
};

const FIELD_OPERATORS = Object.freeze({
  '==': 'EQUAL',
  '<': 'LESS_THAN',
  '<=': 'LESS_THAN_OR_EQUAL',
  '>': 'GREATER_THAN',
  '>=': 'GREATER_THAN_OR_EQUAL',
  'array-contains': 'ARRAY_CONTAINS',
});

const buildWhere = (filters = []) => {
  const fieldFilters = filters.map(({ field, op, value }) => {
    const restOperator = FIELD_OPERATORS[op];

    if (!normalizeText(field) || !restOperator) {
      throw new TypeError(`Filtro Firestore REST no soportado: ${field} ${op}`);
    }

    return {
      fieldFilter: {
        field: { fieldPath: field },
        op: restOperator,
        value: jsToFirestoreValue(value),
      },
    };
  });

  if (!fieldFilters.length) return undefined;
  if (fieldFilters.length === 1) return fieldFilters[0];

  return { compositeFilter: { op: 'AND', filters: fieldFilters } };
};

const encodePath = (path = '') =>
  normalizeText(path)
    .split('/')
    .filter(Boolean)
    .map(encodeURIComponent)
    .join('/');

export class ChatFirestoreRestError extends Error {
  constructor(message, { status = 500, code = 'CHAT_FIRESTORE_REST_ERROR' } = {}) {
    super(message);
    this.name = 'ChatFirestoreRestError';
    this.status = status;
    this.code = code;
  }
}

export const createChatFirestoreRestClient = ({ projectId, token, fetchImpl = fetch } = {}) => {
  if (!normalizeText(projectId) || !normalizeText(token) || typeof fetchImpl !== 'function') {
    throw new TypeError('Firestore REST del chat requiere projectId, token y fetch.');
  }

  const baseUrl = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
    projectId
  )}/databases/(default)/documents`;
  const documentNamePrefix = `projects/${projectId}/databases/(default)/documents`;

  const authorizedFetch = async (url, init = {}) => {
    const response = await fetchImpl(url, {
      ...init,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...(init.headers ?? {}),
      },
      cache: 'no-store',
    });
    const payload = await readJson(response);

    if (!response.ok) {
      throw new ChatFirestoreRestError(
        payload?.error?.message || `Firestore rechazó la operación (${response.status}).`,
        {
          status: response.status,
          code: payload?.error?.status || 'CHAT_FIRESTORE_REST_ERROR',
        }
      );
    }

    return payload;
  };

  const getDocument = async (path) => {
    try {
      const payload = await authorizedFetch(`${baseUrl}/${encodePath(path)}`);
      return firestoreDocumentToObject(payload);
    } catch (error) {
      if (error instanceof ChatFirestoreRestError && error.status === 404) return null;
      throw error;
    }
  };

  const setDocument = async (path, data = {}, { merge = false, fieldPaths = null } = {}) => {
    const url = new URL(`${baseUrl}/${encodePath(path)}`);

    if (merge) {
      const updateMask = Array.isArray(fieldPaths) && fieldPaths.length
        ? fieldPaths
        : Object.keys(data);

      updateMask.forEach((fieldPath) =>
        url.searchParams.append('updateMask.fieldPaths', fieldPath)
      );
    }

    const payload = await authorizedFetch(url, {
      method: 'PATCH',
      body: JSON.stringify({ fields: jsToFirestoreFields(data) }),
    });

    return firestoreDocumentToObject(payload);
  };

  const deleteDocument = async (path) => {
    await authorizedFetch(`${baseUrl}/${encodePath(path)}`, { method: 'DELETE' });
  };

  const runQuery = async ({
    collectionId,
    parentPath = '',
    filters = [],
    orderBy = [],
    limit = null,
    startAfter = [],
  } = {}) => {
    if (!normalizeText(collectionId)) {
      throw new TypeError('runQuery requiere collectionId.');
    }

    const structuredQuery = {
      from: [{ collectionId }],
      ...(buildWhere(filters) ? { where: buildWhere(filters) } : {}),
      ...(orderBy.length
        ? {
            orderBy: orderBy.map(({ field, direction = 'asc' }) => ({
              field: { fieldPath: field },
              direction: String(direction).toLowerCase() === 'desc' ? 'DESCENDING' : 'ASCENDING',
            })),
          }
        : {}),
      ...(Number.isSafeInteger(limit) && limit > 0 ? { limit } : {}),
      ...(Array.isArray(startAfter) && startAfter.length
        ? { startAt: { values: startAfter, before: false } }
        : {}),
    };
    const queryUrl = `${baseUrl}${parentPath ? `/${encodePath(parentPath)}` : ''}:runQuery`;
    const payload = await authorizedFetch(queryUrl, {
      method: 'POST',
      body: JSON.stringify({ structuredQuery }),
    });

    return (Array.isArray(payload) ? payload : [])
      .map((item) => item.document)
      .filter(Boolean)
      .map(firestoreDocumentToObject);
  };

  const listCollection = (collectionId) => runQuery({ collectionId });

  const commitWrites = async (operations = []) => {
    if (!Array.isArray(operations) || !operations.length) return [];
    if (operations.length > 500) {
      throw new TypeError('Firestore admite hasta 500 operaciones por confirmación atómica.');
    }

    const writes = operations.map((operation = {}) => {
      const path = encodePath(operation.path);

      if (!path) throw new TypeError('Cada operación atómica requiere una ruta.');

      if (operation.type === 'delete') {
        return { delete: `${documentNamePrefix}/${path}` };
      }

      if (operation.type !== 'set') {
        throw new TypeError(`Operación Firestore no soportada: ${operation.type}`);
      }

      const data = operation.data ?? {};

      return {
        update: {
          name: `${documentNamePrefix}/${path}`,
          fields: jsToFirestoreFields(data),
        },
        ...(operation.merge ? { updateMask: { fieldPaths: Object.keys(data) } } : {}),
      };
    });
    const payload = await authorizedFetch(`${baseUrl}:commit`, {
      method: 'POST',
      body: JSON.stringify({ writes }),
    });

    return payload?.writeResults ?? [];
  };

  return {
    getDocument,
    setDocument,
    deleteDocument,
    runQuery,
    listCollection,
    commitWrites,
  };
};
