var express = require('express');
var router = express.Router();
var db = require('../config/database');
var { isAuthenticated } = require('../middleware/auth');
var crypto = require('crypto');

/* Download Rapor PDF (placeholder - generates verification token) */
router.get('/rapor/download', isAuthenticated, function(req, res) {
  var userId = req.session.user.id;
  var token = crypto.randomBytes(16).toString('hex');

  // Log document generation
  db.prepare('INSERT INTO dokumen_log (tipe, siswa_id, verification_token) VALUES (?, ?, ?)')
    .run('rapor', userId, token);

  db.prepare('INSERT INTO system_log (user_id, aksi, detail) VALUES (?, ?, ?)')
    .run(userId, 'Download Rapor', req.session.user.nama_lengkap + ' mengunduh rapor. Token: ' + token);

  // For now, redirect back with a message
  res.redirect('/siswa/rapor?download=success&token=' + token);
});

/* Generate CV (placeholder - generates verification token) */
router.get('/cv/generate', isAuthenticated, function(req, res) {
  var userId = req.session.user.id;
  var token = crypto.randomBytes(16).toString('hex');

  db.prepare('INSERT INTO dokumen_log (tipe, siswa_id, verification_token) VALUES (?, ?, ?)')
    .run('cv', userId, token);

  db.prepare('INSERT INTO system_log (user_id, aksi, detail) VALUES (?, ?, ?)')
    .run(userId, 'Generate CV', req.session.user.nama_lengkap + ' membuat CV. Token: ' + token);

  res.redirect('/siswa/career-builder?generated=1&token=' + token);
});

/* Template download (placeholder) */
router.get('/template/download', function(req, res) {
  // In production, this would generate an Excel template
  res.redirect('/guru/input-nilai?error=' + encodeURIComponent('Template Excel akan segera tersedia.'));
});

module.exports = router;
