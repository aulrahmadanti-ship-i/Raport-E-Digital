var express = require('express');
var router = express.Router();
var db = require('../config/database');
var { isAuthenticated, isRole } = require('../middleware/auth');

// Apply middleware to all siswa routes
router.use(isAuthenticated, isRole('siswa'));

/* Dashboard */
router.get('/dashboard', function(req, res) {
  var userId = req.session.user.id;

  // Get siswa detail
  var siswaDetail = db.prepare('SELECT * FROM siswa_detail WHERE user_id = ?').get(userId);

  // Get kelas
  var kelas = null;
  if (siswaDetail && siswaDetail.kelas_id) {
    kelas = db.prepare('SELECT * FROM kelas WHERE id = ?').get(siswaDetail.kelas_id);
  }

  // Calculate stats
  var nilaiRows = db.prepare(`
    SELECT n.nilai_pengetahuan, n.nilai_keterampilan
    FROM nilai n
    WHERE n.siswa_id = ? AND n.status = 'published'
  `).all(userId);

  var totalNilai = 0;
  var count = 0;
  nilaiRows.forEach(function(n) {
    if (n.nilai_pengetahuan) { totalNilai += n.nilai_pengetahuan; count++; }
    if (n.nilai_keterampilan) { totalNilai += n.nilai_keterampilan; count++; }
  });

  var ipk = count > 0 ? (totalNilai / count / 25).toFixed(2) : '0.00';

  var kehadiran = db.prepare('SELECT * FROM kehadiran WHERE siswa_id = ? ORDER BY id DESC LIMIT 1').get(userId);
  var totalHadir = 100;
  if (kehadiran) {
    var totalAbsence = (kehadiran.sakit || 0) + (kehadiran.izin || 0) + (kehadiran.alpa || 0);
    totalHadir = Math.max(0, 100 - totalAbsence);
  }

  var stats = {
    ipk: ipk,
    ranking: 5,
    kehadiran: totalHadir
  };

  res.render('siswa/dashboard', {
    title: 'Dashboard Siswa',
    user: req.session.user,
    siswaDetail: siswaDetail,
    kelas: kelas,
    stats: stats
  });
});

/* Rapor */
router.get('/rapor', function(req, res) {
  var userId = req.session.user.id;
  var semester = req.query.semester || 'Ganjil';
  var tahun = req.query.tahun || '2024/2025';
  var selectedSemester = semester + ' ' + tahun;

  var siswaDetail = db.prepare('SELECT * FROM siswa_detail WHERE user_id = ?').get(userId);
  var kelas = null;
  if (siswaDetail && siswaDetail.kelas_id) {
    kelas = db.prepare('SELECT * FROM kelas WHERE id = ?').get(siswaDetail.kelas_id);
  }

  // Get nilai
  var nilai = db.prepare(`
    SELECT n.*, mp.nama as nama_mapel, mp.kkm
    FROM nilai n
    JOIN mata_pelajaran mp ON n.mapel_id = mp.id
    WHERE n.siswa_id = ? AND n.semester = ? AND n.tahun_ajaran = ? AND n.status = 'published'
    ORDER BY mp.nama
  `).all(userId, semester, tahun);

  // Get kehadiran
  var kehadiran = db.prepare('SELECT * FROM kehadiran WHERE siswa_id = ? AND semester = ? AND tahun_ajaran = ?')
    .get(userId, semester, tahun) || { sakit: 0, izin: 0, alpa: 0 };

  // Get ekstrakurikuler
  var ekskul = db.prepare('SELECT * FROM ekstrakurikuler WHERE siswa_id = ? AND semester = ? AND tahun_ajaran = ?')
    .all(userId, semester, tahun);

  res.render('siswa/rapor', {
    title: 'Rapor Digital',
    user: req.session.user,
    siswaDetail: siswaDetail,
    kelas: kelas,
    nilai: nilai,
    kehadiran: kehadiran,
    ekskul: ekskul,
    selectedSemester: selectedSemester
  });
});

/* Career Builder */
router.get('/career-builder', function(req, res) {
  var userId = req.session.user.id;

  // Get CV data
  var cvData = db.prepare('SELECT * FROM cv_data WHERE siswa_id = ?').get(userId);

  // Get top skills from best grades
  var topNilai = db.prepare(`
    SELECT mp.nama, n.nilai_pengetahuan
    FROM nilai n
    JOIN mata_pelajaran mp ON n.mapel_id = mp.id
    WHERE n.siswa_id = ? AND n.status = 'published' AND n.nilai_pengetahuan IS NOT NULL
    ORDER BY n.nilai_pengetahuan DESC
    LIMIT 5
  `).all(userId);

  var topSkills = topNilai.map(function(n) {
    return n.nama + ' (' + n.nilai_pengetahuan + ')';
  });

  res.render('siswa/career-builder', {
    title: 'Career Builder',
    user: req.session.user,
    cvData: cvData,
    topSkills: topSkills
  });
});

/* Save CV data */
router.post('/career-builder/save', function(req, res) {
  var userId = req.session.user.id;
  var { template, target_pekerjaan, tentang_saya, pengalaman_judul, pengalaman_desc } = req.body;

  var existing = db.prepare('SELECT id FROM cv_data WHERE siswa_id = ?').get(userId);

  if (existing) {
    db.prepare(`
      UPDATE cv_data SET template = ?, target_pekerjaan = ?, tentang_saya = ?, pengalaman_judul = ?, pengalaman_desc = ?, updated_at = CURRENT_TIMESTAMP
      WHERE siswa_id = ?
    `).run(template, target_pekerjaan, tentang_saya, pengalaman_judul, pengalaman_desc, userId);
  } else {
    db.prepare(`
      INSERT INTO cv_data (siswa_id, template, target_pekerjaan, tentang_saya, pengalaman_judul, pengalaman_desc) VALUES (?, ?, ?, ?, ?, ?)
    `).run(userId, template, target_pekerjaan, tentang_saya, pengalaman_judul, pengalaman_desc);
  }

  db.prepare('INSERT INTO system_log (user_id, aksi, detail) VALUES (?, ?, ?)')
    .run(userId, 'Update CV', req.session.user.nama_lengkap + ' memperbarui data CV.');

  res.redirect('/siswa/career-builder');
});

module.exports = router;
