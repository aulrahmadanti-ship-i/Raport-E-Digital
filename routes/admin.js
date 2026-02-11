var express = require('express');
var router = express.Router();
var bcrypt = require('bcryptjs');
var db = require('../config/database');
var { isAuthenticated, isRole } = require('../middleware/auth');

router.use(isAuthenticated, isRole('admin'));

/* Dashboard */
router.get('/dashboard', function(req, res) {
  var stats = {
    totalSiswa: db.prepare('SELECT COUNT(*) as count FROM users WHERE role = ?').get('siswa').count,
    totalGuru: db.prepare('SELECT COUNT(*) as count FROM users WHERE role = ?').get('guru').count,
    totalKelas: db.prepare('SELECT COUNT(*) as count FROM kelas').get().count,
    totalMapel: db.prepare('SELECT COUNT(*) as count FROM mata_pelajaran').get().count
  };

  var logs = db.prepare(`
    SELECT sl.*, u.nama_lengkap
    FROM system_log sl
    LEFT JOIN users u ON sl.user_id = u.id
    ORDER BY sl.created_at DESC
    LIMIT 20
  `).all();

  res.render('admin/dashboard', {
    title: 'Panel Admin',
    user: req.session.user,
    stats: stats,
    logs: logs
  });
});

/* Data Siswa */
router.get('/siswa', function(req, res) {
  var siswaList = db.prepare(`
    SELECT u.*, sd.nisn, sd.kelas_id, sd.jenis_kelamin, sd.tempat_lahir, sd.tanggal_lahir, k.nama_kelas
    FROM users u
    JOIN siswa_detail sd ON u.id = sd.user_id
    LEFT JOIN kelas k ON sd.kelas_id = k.id
    WHERE u.role = 'siswa'
    ORDER BY u.nama_lengkap
  `).all();

  var kelasList = db.prepare('SELECT * FROM kelas ORDER BY nama_kelas').all();

  res.render('admin/siswa', {
    title: 'Data Siswa',
    user: req.session.user,
    siswaList: siswaList,
    kelasList: kelasList,
    message: req.query.success || null,
    errorMsg: req.query.error || null
  });
});

/* Add Siswa */
router.post('/siswa/add', function(req, res) {
  try {
    var { nama_lengkap, username, nisn, kelas_id, jenis_kelamin, tempat_lahir, tanggal_lahir, email } = req.body;
    var hashPassword = bcrypt.hashSync('siswa123', 10);

    var result = db.prepare('INSERT INTO users (username, password, role, nama_lengkap, email) VALUES (?, ?, ?, ?, ?)')
      .run(username, hashPassword, 'siswa', nama_lengkap, email || null);

    db.prepare('INSERT INTO siswa_detail (user_id, nisn, kelas_id, tempat_lahir, tanggal_lahir, jenis_kelamin) VALUES (?, ?, ?, ?, ?, ?)')
      .run(result.lastInsertRowid, nisn, kelas_id, tempat_lahir || null, tanggal_lahir || null, jenis_kelamin);

    db.prepare('INSERT INTO system_log (user_id, aksi, detail) VALUES (?, ?, ?)')
      .run(req.session.user.id, 'Tambah Siswa', 'Menambahkan siswa: ' + nama_lengkap);

    res.redirect('/admin/siswa?success=' + encodeURIComponent('Siswa berhasil ditambahkan.'));
  } catch (err) {
    res.redirect('/admin/siswa?error=' + encodeURIComponent('Gagal menambah siswa: ' + err.message));
  }
});

/* Delete Siswa */
router.post('/siswa/delete/:id', function(req, res) {
  try {
    var userId = req.params.id;
    db.prepare('DELETE FROM siswa_detail WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM nilai WHERE siswa_id = ?').run(userId);
    db.prepare('DELETE FROM kehadiran WHERE siswa_id = ?').run(userId);
    db.prepare('DELETE FROM ekstrakurikuler WHERE siswa_id = ?').run(userId);
    db.prepare('DELETE FROM cv_data WHERE siswa_id = ?').run(userId);
    db.prepare('DELETE FROM users WHERE id = ?').run(userId);

    db.prepare('INSERT INTO system_log (user_id, aksi, detail) VALUES (?, ?, ?)')
      .run(req.session.user.id, 'Hapus Siswa', 'Menghapus siswa ID: ' + userId);

    res.redirect('/admin/siswa?success=' + encodeURIComponent('Siswa berhasil dihapus.'));
  } catch (err) {
    res.redirect('/admin/siswa?error=' + encodeURIComponent('Gagal menghapus siswa: ' + err.message));
  }
});

/* Data Guru */
router.get('/guru', function(req, res) {
  var guruList = db.prepare(`
    SELECT u.*, gd.nip, gd.mata_pelajaran, gd.telepon
    FROM users u
    LEFT JOIN guru_detail gd ON u.id = gd.user_id
    WHERE u.role = 'guru'
    ORDER BY u.nama_lengkap
  `).all();

  res.render('admin/guru', {
    title: 'Data Guru',
    user: req.session.user,
    guruList: guruList,
    message: req.query.success || null,
    errorMsg: req.query.error || null
  });
});

/* Add Guru */
router.post('/guru/add', function(req, res) {
  try {
    var { nama_lengkap, username, nip, mata_pelajaran, email, telepon } = req.body;
    var hashPassword = bcrypt.hashSync('guru123', 10);

    var result = db.prepare('INSERT INTO users (username, password, role, nama_lengkap, email) VALUES (?, ?, ?, ?, ?)')
      .run(username, hashPassword, 'guru', nama_lengkap, email || null);

    db.prepare('INSERT INTO guru_detail (user_id, nip, mata_pelajaran, telepon) VALUES (?, ?, ?, ?)')
      .run(result.lastInsertRowid, nip || null, mata_pelajaran || null, telepon || null);

    db.prepare('INSERT INTO system_log (user_id, aksi, detail) VALUES (?, ?, ?)')
      .run(req.session.user.id, 'Tambah Guru', 'Menambahkan guru: ' + nama_lengkap);

    res.redirect('/admin/guru?success=' + encodeURIComponent('Guru berhasil ditambahkan.'));
  } catch (err) {
    res.redirect('/admin/guru?error=' + encodeURIComponent('Gagal menambah guru: ' + err.message));
  }
});

/* Data Kelas */
router.get('/kelas', function(req, res) {
  var kelasList = db.prepare(`
    SELECT k.*, u.nama_lengkap as wali_kelas
    FROM kelas k
    LEFT JOIN users u ON k.wali_kelas_id = u.id
    ORDER BY k.nama_kelas
  `).all();

  var guruList = db.prepare('SELECT id, nama_lengkap FROM users WHERE role = ? ORDER BY nama_lengkap').all('guru');

  res.render('admin/kelas', {
    title: 'Data Kelas',
    user: req.session.user,
    kelasList: kelasList,
    guruList: guruList,
    message: req.query.success || null,
    errorMsg: req.query.error || null
  });
});

/* Add Kelas */
router.post('/kelas/add', function(req, res) {
  try {
    var { nama_kelas, jurusan, tahun_ajaran, wali_kelas_id } = req.body;
    db.prepare('INSERT INTO kelas (nama_kelas, jurusan, tahun_ajaran, wali_kelas_id) VALUES (?, ?, ?, ?)')
      .run(nama_kelas, jurusan, tahun_ajaran, wali_kelas_id || null);

    db.prepare('INSERT INTO system_log (user_id, aksi, detail) VALUES (?, ?, ?)')
      .run(req.session.user.id, 'Tambah Kelas', 'Menambahkan kelas: ' + nama_kelas);

    res.redirect('/admin/kelas?success=' + encodeURIComponent('Kelas berhasil ditambahkan.'));
  } catch (err) {
    res.redirect('/admin/kelas?error=' + encodeURIComponent('Gagal menambah kelas: ' + err.message));
  }
});

/* Mata Pelajaran */
router.get('/mapel', function(req, res) {
  var mapelList = db.prepare(`
    SELECT mp.*, u.nama_lengkap as nama_guru, k.nama_kelas
    FROM mata_pelajaran mp
    LEFT JOIN users u ON mp.guru_id = u.id
    LEFT JOIN kelas k ON mp.kelas_id = k.id
    ORDER BY mp.nama
  `).all();

  var guruList = db.prepare('SELECT id, nama_lengkap FROM users WHERE role = ? ORDER BY nama_lengkap').all('guru');
  var kelasList = db.prepare('SELECT * FROM kelas ORDER BY nama_kelas').all();

  res.render('admin/mapel', {
    title: 'Mata Pelajaran',
    user: req.session.user,
    mapelList: mapelList,
    guruList: guruList,
    kelasList: kelasList,
    message: req.query.success || null,
    errorMsg: req.query.error || null
  });
});

/* Add Mapel */
router.post('/mapel/add', function(req, res) {
  try {
    var { nama, kode, kkm, guru_id, kelas_id } = req.body;
    db.prepare('INSERT INTO mata_pelajaran (nama, kode, kkm, guru_id, kelas_id) VALUES (?, ?, ?, ?, ?)')
      .run(nama, kode, parseInt(kkm) || 75, guru_id || null, kelas_id || null);

    db.prepare('INSERT INTO system_log (user_id, aksi, detail) VALUES (?, ?, ?)')
      .run(req.session.user.id, 'Tambah Mapel', 'Menambahkan mata pelajaran: ' + nama);

    res.redirect('/admin/mapel?success=' + encodeURIComponent('Mata pelajaran berhasil ditambahkan.'));
  } catch (err) {
    res.redirect('/admin/mapel?error=' + encodeURIComponent('Gagal menambah mapel: ' + err.message));
  }
});

module.exports = router;
