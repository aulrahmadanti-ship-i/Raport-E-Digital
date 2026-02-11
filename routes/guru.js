var express = require('express');
var router = express.Router();
var db = require('../config/database');
var { isAuthenticated, isRole } = require('../middleware/auth');

router.use(isAuthenticated, isRole('guru'));

/* Dashboard */
router.get('/dashboard', function(req, res) {
  var userId = req.session.user.id;

  var totalSiswa = db.prepare('SELECT COUNT(*) as count FROM users WHERE role = ?').get('siswa').count;
  var totalMapel = db.prepare('SELECT COUNT(*) as count FROM mata_pelajaran WHERE guru_id = ?').get(userId).count;
  var nilaiTerisi = db.prepare(`
    SELECT COUNT(*) as count FROM nilai n
    JOIN mata_pelajaran mp ON n.mapel_id = mp.id
    WHERE mp.guru_id = ?
  `).get(userId).count;
  var totalKelas = db.prepare('SELECT COUNT(DISTINCT kelas_id) as count FROM mata_pelajaran WHERE guru_id = ?').get(userId).count;

  res.render('guru/dashboard', {
    title: 'Dashboard Guru',
    user: req.session.user,
    totalSiswa: totalSiswa,
    totalMapel: totalMapel,
    nilaiTerisi: nilaiTerisi,
    totalKelas: totalKelas
  });
});

/* Input Nilai */
router.get('/input-nilai', function(req, res) {
  var userId = req.session.user.id;

  // Get available kelas
  var kelasList = db.prepare('SELECT DISTINCT k.* FROM kelas k').all();

  // Get mapel for this guru
  var mapelList = db.prepare('SELECT * FROM mata_pelajaran WHERE guru_id = ? OR guru_id IS NULL').all(userId);

  var selectedKelas = req.query.kelas_id || (kelasList.length > 0 ? kelasList[0].id : null);
  var selectedMapel = req.query.mapel_id || (mapelList.length > 0 ? mapelList[0].id : null);

  // Get students in selected kelas with their nilai
  var students = [];
  if (selectedKelas && selectedMapel) {
    students = db.prepare(`
      SELECT u.id as user_id, u.nama_lengkap, sd.nisn,
             n.nilai_pengetahuan, n.nilai_keterampilan, n.catatan
      FROM users u
      JOIN siswa_detail sd ON u.id = sd.user_id
      LEFT JOIN nilai n ON n.siswa_id = u.id AND n.mapel_id = ?
      WHERE sd.kelas_id = ? AND u.role = 'siswa'
      ORDER BY u.nama_lengkap
    `).all(selectedMapel, selectedKelas);
  }

  // Get KKM
  var mapelData = db.prepare('SELECT kkm FROM mata_pelajaran WHERE id = ?').get(selectedMapel);
  var selectedMapelKkm = mapelData ? mapelData.kkm : 75;

  res.render('guru/input-nilai', {
    title: 'Input Nilai',
    user: req.session.user,
    kelasList: kelasList,
    mapelList: mapelList,
    selectedKelas: selectedKelas,
    selectedMapel: selectedMapel,
    selectedMapelKkm: selectedMapelKkm,
    students: students,
    message: req.query.success ? 'Nilai berhasil disimpan!' : null,
    errorMsg: req.query.error || null
  });
});

/* Save Nilai */
router.post('/save-nilai', function(req, res) {
  var mapelId = req.body.mapel_id;
  var semester = req.body.semester || 'Ganjil';
  var tahunAjaran = req.body.tahun_ajaran || '2024/2025';
  var siswaIds = req.body['siswa_ids[]'] || [];
  var pengetahuan = req.body['pengetahuan[]'] || [];
  var keterampilan = req.body['keterampilan[]'] || [];
  var catatan = req.body['catatan[]'] || [];

  // Normalize to arrays
  if (!Array.isArray(siswaIds)) siswaIds = [siswaIds];
  if (!Array.isArray(pengetahuan)) pengetahuan = [pengetahuan];
  if (!Array.isArray(keterampilan)) keterampilan = [keterampilan];
  if (!Array.isArray(catatan)) catatan = [catatan];

  try {
    var upsert = db.prepare(`
      INSERT INTO nilai (siswa_id, mapel_id, semester, tahun_ajaran, nilai_pengetahuan, nilai_keterampilan, predikat, catatan, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'published')
      ON CONFLICT(siswa_id, mapel_id, semester, tahun_ajaran) DO UPDATE SET
        nilai_pengetahuan = excluded.nilai_pengetahuan,
        nilai_keterampilan = excluded.nilai_keterampilan,
        predikat = excluded.predikat,
        catatan = excluded.catatan,
        status = 'published',
        updated_at = CURRENT_TIMESTAMP
    `);

    // Add unique constraint if not exists (for upsert to work)
    try {
      db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_nilai_unique ON nilai(siswa_id, mapel_id, semester, tahun_ajaran)');
    } catch(e) { /* ignore if exists */ }

    var insertOrUpdate = db.transaction(function() {
      for (var i = 0; i < siswaIds.length; i++) {
        var np = parseInt(pengetahuan[i]) || null;
        var nk = parseInt(keterampilan[i]) || null;
        var avg = 0;
        var count = 0;
        if (np) { avg += np; count++; }
        if (nk) { avg += nk; count++; }
        avg = count > 0 ? avg / count : 0;

        var predikat = '-';
        if (avg >= 88) predikat = 'A';
        else if (avg >= 75) predikat = 'B';
        else if (avg >= 62) predikat = 'C';
        else if (avg > 0) predikat = 'D';

        // Check existing
        var existing = db.prepare('SELECT id FROM nilai WHERE siswa_id = ? AND mapel_id = ? AND semester = ? AND tahun_ajaran = ?')
          .get(siswaIds[i], mapelId, semester, tahunAjaran);

        if (existing) {
          db.prepare(`
            UPDATE nilai SET nilai_pengetahuan = ?, nilai_keterampilan = ?, predikat = ?, catatan = ?, status = 'published', updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `).run(np, nk, predikat, catatan[i] || '', existing.id);
        } else {
          db.prepare(`
            INSERT INTO nilai (siswa_id, mapel_id, semester, tahun_ajaran, nilai_pengetahuan, nilai_keterampilan, predikat, catatan, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'published')
          `).run(siswaIds[i], mapelId, semester, tahunAjaran, np, nk, predikat, catatan[i] || '');
        }
      }
    });

    insertOrUpdate();

    db.prepare('INSERT INTO system_log (user_id, aksi, detail) VALUES (?, ?, ?)')
      .run(req.session.user.id, 'Input Nilai', req.session.user.nama_lengkap + ' menyimpan nilai mata pelajaran.');

    res.redirect('/guru/input-nilai?success=1');
  } catch (err) {
    console.error('Save nilai error:', err);
    res.redirect('/guru/input-nilai?error=' + encodeURIComponent('Gagal menyimpan nilai: ' + err.message));
  }
});

/* Upload Excel */
router.post('/upload-nilai', function(req, res) {
  // Handled by multer in api routes or redirect
  res.redirect('/guru/input-nilai?error=' + encodeURIComponent('Upload Excel diproses melalui API.'));
});

module.exports = router;
