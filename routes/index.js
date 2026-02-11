var express = require('express');
var router = express.Router();
var db = require('../config/database');

/* Landing page */
router.get('/', function(req, res) {
  res.render('landing', { title: 'Beranda' });
});

/* Verification page */
router.get('/verification', function(req, res) {
  var token = req.query.token;
  var result = null;

  if (token) {
    var doc = db.prepare(`
      SELECT dl.*, u.nama_lengkap as nama_siswa
      FROM dokumen_log dl
      JOIN users u ON dl.siswa_id = u.id
      WHERE dl.verification_token = ?
    `).get(token);

    if (doc) {
      result = {
        valid: true,
        tipe: doc.tipe,
        nama_siswa: doc.nama_siswa,
        created_at: doc.created_at,
        verification_token: doc.verification_token
      };
    } else {
      result = { valid: false };
    }
  }

  res.render('verification', { title: 'Verifikasi Dokumen', token: token || '', result: result });
});

module.exports = router;
