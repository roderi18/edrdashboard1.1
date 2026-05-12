// ----------------------------------------------------------------------

export function rowInPage(data, page, rowsPerPage) {
  return data.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
}

// ----------------------------------------------------------------------

export function emptyRows(page, rowsPerPage, arrayLength) {
  return page ? Math.max(0, (1 + page) * rowsPerPage - arrayLength) : 0;
}

// ----------------------------------------------------------------------

/**
 * @example
 * const data = {
 *   calories: 360,
 *   align: 'center',
 *   more: {
 *     protein: 42,
 *   },
 * };
 *
 * const ex1 = getNestedProperty(data, 'calories');
 *
 * const ex2 = getNestedProperty(data, 'align');
 *
 * const ex3 = getNestedProperty(data, 'more.protein');
 */
function getNestedProperty(obj, key) {
  return key.split('.').reduce((acc, part) => acc && acc[part], obj);
}

function descendingComparator(a, b, orderBy) {
  const aValue = getNestedProperty(a, orderBy);
  const bValue = getNestedProperty(b, orderBy);

  if (bValue < aValue) {
    return -1;
  }

  if (bValue > aValue) {
    return 1;
  }

  return 0;
}

// ----------------------------------------------------------------------

export function getComparator(order, orderBy) {
  return order === 'desc'
    ? (a, b) => descendingComparator(a, b, orderBy)
    : (a, b) => -descendingComparator(a, b, orderBy);
}
