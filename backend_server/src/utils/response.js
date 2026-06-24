function ok(res, data, message = 'Sukses', status = 200) {
  return res.status(status).json({ success: true, message, data });
}

function created(res, data, message = 'Data berhasil dibuat') {
  return ok(res, data, message, 201);
}

function error(res, message = 'Terjadi kesalahan', status = 500, errors = null) {
  const body = { success: false, message };
  if (errors) body.errors = errors;
  return res.status(status).json(body);
}

function notFound(res, message = 'Data tidak ditemukan') {
  return error(res, message, 404);
}

function forbidden(res, message = 'Akses ditolak') {
  return error(res, message, 403);
}

function unauthorized(res, message = 'Token tidak valid atau sudah kedaluwarsa') {
  return error(res, message, 401);
}

function badRequest(res, message = 'Request tidak valid', errors = null) {
  return error(res, message, 422, errors);
}

module.exports = { ok, created, error, notFound, forbidden, unauthorized, badRequest };
