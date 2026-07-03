// src/utils/paginate.js

/**
 * Extracts pagination params from query string and returns
 * skip/limit for MongoDB + metadata for response.
 *
 * Usage: const { skip, limit, pagination } = paginate(req.query);
 */
const paginate = (query = {}) => {
  const page  = Math.max(parseInt(query.page,  10) || 1, 1);
  const limit = Math.min(parseInt(query.limit, 10) || 20, 100);
  const skip  = (page - 1) * limit;

  const buildPagination = (totalCount) => ({
    page,
    limit,
    totalCount,
    totalPages: Math.ceil(totalCount / limit),
    hasNextPage: page < Math.ceil(totalCount / limit),
    hasPrevPage: page > 1,
  });

  return { skip, limit, buildPagination };
};

module.exports = { paginate };
