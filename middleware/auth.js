// Authentication middleware
function isAuthenticated(req, res, next) {
  if (req.session && req.session.user) {
    return next();
  }
  res.redirect('/auth/login');
}

function isRole(role) {
  return function(req, res, next) {
    if (req.session && req.session.user && req.session.user.role === role) {
      return next();
    }
    res.status(403).render('error', {
      title: 'Akses Ditolak',
      message: 'Anda tidak memiliki akses ke halaman ini.',
      error: { status: 403, stack: '' }
    });
  };
}

function isGuruOrAdmin(req, res, next) {
  if (req.session && req.session.user && (req.session.user.role === 'guru' || req.session.user.role === 'admin')) {
    return next();
  }
  res.status(403).render('error', {
    title: 'Akses Ditolak',
    message: 'Anda tidak memiliki akses ke halaman ini.',
    error: { status: 403, stack: '' }
  });
}

module.exports = { isAuthenticated, isRole, isGuruOrAdmin };
