const { Sequelize } = require("sequelize");

/**
 * ORDER BY entries for a user-selected sort column that keep PostgreSQL's NULL placement on MariaDB.
 *
 *   PostgreSQL: ASC  -> NULLS LAST,   DESC -> NULLS FIRST
 *   MariaDB   : ASC  -> NULLs first,  DESC -> NULLs last      (the opposite)
 *
 * A column that can hold NULL therefore gets an explicit "(<column> IS NULL)" key, sorted in the SAME direction as the
 * requested one (ASC: rows with a value first; DESC: NULL rows first), ahead of the real sort key. The direction of the
 * real key, and so the order of all non-NULL values, is exactly what the caller asked for.
 *
 * Columns that cannot be NULL (NOT NULL columns, primary keys) and names that are not model columns get the plain
 * [[field, direction]] the code always used, so their SQL is unchanged.
 *
 * @param {import('sequelize').ModelStatic<any>} model   model whose rows are being sorted
 * @param {string} sortField                              already validated against the handler's allow-list
 * @param {'ASC'|'DESC'} sortDirection
 */
const orderLikePostgres = (model, sortField, sortDirection) => {
  const attribute = model.rawAttributes[sortField];
  const canBeNull = attribute && attribute.allowNull !== false && !attribute.primaryKey;
  if (!canBeNull) return [[sortField, sortDirection]];

  const queryInterface = model.sequelize.getQueryInterface();
  const column = `${queryInterface.quoteIdentifier(model.name)}.${queryInterface.quoteIdentifier(attribute.field || sortField)}`;
  return [
    [Sequelize.literal(`(${column} IS NULL)`), sortDirection],
    [sortField, sortDirection],
  ];
};

module.exports = orderLikePostgres;
