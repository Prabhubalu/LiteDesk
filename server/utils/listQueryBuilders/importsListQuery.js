function buildImportsListQuery(req) {
  const query = { organizationId: req.user.organizationId };

  if (req.query.module) query.module = req.query.module;
  if (req.query.status) query.status = req.query.status;
  if (req.query.importedBy) query.importedBy = req.query.importedBy;

  return query;
}

module.exports = {
  buildImportsListQuery,
};
