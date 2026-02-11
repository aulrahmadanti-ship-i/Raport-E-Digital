const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = path.join(__dirname, '..', 'data', 'erapor.db');

// Ensure data directory exists
const fs = require('fs');
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(dbPath);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('admin', 'guru', 'siswa')),
    nama_lengkap TEXT NOT NULL,
    email TEXT,
    foto TEXT DEFAULT '/images/default-avatar.png',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS kelas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nama_kelas TEXT NOT NULL,
    jurusan TEXT,
    tahun_ajaran TEXT NOT NULL,
    wali_kelas_id INTEGER,
    FOREIGN KEY (wali_kelas_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS siswa_detail (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    nisn TEXT UNIQUE NOT NULL,
    kelas_id INTEGER,
    tempat_lahir TEXT,
    tanggal_lahir DATE,
    jenis_kelamin TEXT CHECK(jenis_kelamin IN ('L', 'P')),
    alamat TEXT,
    nama_ortu TEXT,
    telepon TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (kelas_id) REFERENCES kelas(id)
  );

  CREATE TABLE IF NOT EXISTS guru_detail (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    nip TEXT UNIQUE,
    mata_pelajaran TEXT,
    telepon TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS mata_pelajaran (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nama TEXT NOT NULL,
    kode TEXT UNIQUE NOT NULL,
    kkm INTEGER DEFAULT 75,
    guru_id INTEGER,
    kelas_id INTEGER,
    FOREIGN KEY (guru_id) REFERENCES users(id),
    FOREIGN KEY (kelas_id) REFERENCES kelas(id)
  );

  CREATE TABLE IF NOT EXISTS nilai (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    siswa_id INTEGER NOT NULL,
    mapel_id INTEGER NOT NULL,
    semester TEXT NOT NULL,
    tahun_ajaran TEXT NOT NULL,
    nilai_pengetahuan INTEGER,
    nilai_keterampilan INTEGER,
    predikat TEXT,
    catatan TEXT,
    status TEXT DEFAULT 'draft' CHECK(status IN ('draft', 'published')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (siswa_id) REFERENCES users(id),
    FOREIGN KEY (mapel_id) REFERENCES mata_pelajaran(id)
  );

  CREATE TABLE IF NOT EXISTS kehadiran (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    siswa_id INTEGER NOT NULL,
    semester TEXT NOT NULL,
    tahun_ajaran TEXT NOT NULL,
    sakit INTEGER DEFAULT 0,
    izin INTEGER DEFAULT 0,
    alpa INTEGER DEFAULT 0,
    FOREIGN KEY (siswa_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS ekstrakurikuler (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    siswa_id INTEGER NOT NULL,
    nama_ekskul TEXT NOT NULL,
    nilai TEXT,
    keterangan TEXT,
    semester TEXT,
    tahun_ajaran TEXT,
    FOREIGN KEY (siswa_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS cv_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    siswa_id INTEGER NOT NULL,
    template TEXT DEFAULT 'modern',
    target_pekerjaan TEXT,
    tentang_saya TEXT,
    pengalaman_judul TEXT,
    pengalaman_desc TEXT,
    organisasi TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (siswa_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS dokumen_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tipe TEXT NOT NULL CHECK(tipe IN ('rapor', 'cv')),
    siswa_id INTEGER NOT NULL,
    qr_code TEXT,
    verification_token TEXT UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (siswa_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS system_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    aksi TEXT NOT NULL,
    detail TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);

// Seed default data if empty
const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get();
if (userCount.count === 0) {
  const hashPassword = bcrypt.hashSync('admin123', 10);
  const hashGuru = bcrypt.hashSync('guru123', 10);
  const hashSiswa = bcrypt.hashSync('siswa123', 10);

  // Insert admin
  db.prepare(`INSERT INTO users (username, password, role, nama_lengkap, email) VALUES (?, ?, ?, ?, ?)`)
    .run('admin', hashPassword, 'admin', 'Administrator', 'admin@erapor.sch.id');

  // Insert guru
  const guruStmt = db.prepare(`INSERT INTO users (username, password, role, nama_lengkap, email) VALUES (?, ?, ?, ?, ?)`);
  const guru1 = guruStmt.run('budi.santoso', hashGuru, 'guru', 'Bpk. Budi Santoso, S.Pd', 'budi@erapor.sch.id');
  const guru2 = guruStmt.run('siti.aminah', hashGuru, 'guru', 'Ibu Siti Aminah, M.Pd', 'siti@erapor.sch.id');
  const guru3 = guruStmt.run('hendro.wibowo', hashGuru, 'guru', 'Dr. Hendro Wibowo, M.Pd', 'hendro@erapor.sch.id');

  db.prepare(`INSERT INTO guru_detail (user_id, nip, mata_pelajaran, telepon) VALUES (?, ?, ?, ?)`)
    .run(guru1.lastInsertRowid, '198501012010011001', 'Matematika', '081234567890');
  db.prepare(`INSERT INTO guru_detail (user_id, nip, mata_pelajaran, telepon) VALUES (?, ?, ?, ?)`)
    .run(guru2.lastInsertRowid, '198601022011012002', 'Fisika', '081234567891');
  db.prepare(`INSERT INTO guru_detail (user_id, nip, mata_pelajaran, telepon) VALUES (?, ?, ?, ?)`)
    .run(guru3.lastInsertRowid, '197001031995031003', 'Bahasa Inggris', '081234567892');

  // Insert kelas
  db.prepare(`INSERT INTO kelas (nama_kelas, jurusan, tahun_ajaran, wali_kelas_id) VALUES (?, ?, ?, ?)`)
    .run('XII-IPA 1', 'IPA', '2024/2025', guru1.lastInsertRowid);
  db.prepare(`INSERT INTO kelas (nama_kelas, jurusan, tahun_ajaran, wali_kelas_id) VALUES (?, ?, ?, ?)`)
    .run('XII-IPA 2', 'IPA', '2024/2025', guru2.lastInsertRowid);
  db.prepare(`INSERT INTO kelas (nama_kelas, jurusan, tahun_ajaran, wali_kelas_id) VALUES (?, ?, ?, ?)`)
    .run('XII-IPS 1', 'IPS', '2024/2025', guru3.lastInsertRowid);

  // Insert siswa
  const siswaStmt = db.prepare(`INSERT INTO users (username, password, role, nama_lengkap, email) VALUES (?, ?, ?, ?, ?)`);
  const siswaNames = [
    ['rizky.pratama', 'Rizky Pratama', 'rizky@siswa.sch.id'],
    ['ahmad.dahlan', 'Ahmad Dahlan', 'ahmad@siswa.sch.id'],
    ['citra.kirana', 'Citra Kirana', 'citra@siswa.sch.id'],
    ['dewi.sartika', 'Dewi Sartika', 'dewi@siswa.sch.id'],
    ['eko.patrio', 'Eko Patrio', 'eko@siswa.sch.id'],
    ['fanny.fadillah', 'Fanny Fadillah', 'fanny@siswa.sch.id'],
    ['gilang.dirga', 'Gilang Dirga', 'gilang@siswa.sch.id'],
    ['hesti.purwa', 'Hesti Purwadinata', 'hesti@siswa.sch.id'],
    ['indra.bekti', 'Indra Bekti', 'indra@siswa.sch.id'],
    ['joko.anwar', 'Joko Anwar', 'joko@siswa.sch.id'],
  ];

  const siswaDetailStmt = db.prepare(`INSERT INTO siswa_detail (user_id, nisn, kelas_id, tempat_lahir, tanggal_lahir, jenis_kelamin) VALUES (?, ?, ?, ?, ?, ?)`);

  siswaNames.forEach((s, idx) => {
    const result = siswaStmt.run(s[0], hashSiswa, 'siswa', s[1], s[2]);
    siswaDetailStmt.run(
      result.lastInsertRowid,
      `00567812${(34 + idx).toString().padStart(2, '0')}`,
      1, // kelas XII-IPA 1
      'Jakarta',
      `2006-${(idx + 1).toString().padStart(2, '0')}-15`,
      idx % 2 === 0 ? 'L' : 'P'
    );
  });

  // Insert mata pelajaran
  const mapelStmt = db.prepare(`INSERT INTO mata_pelajaran (nama, kode, kkm, guru_id, kelas_id) VALUES (?, ?, ?, ?, ?)`);
  const mapels = [
    ['Matematika Wajib', 'MAT-01', 75, guru1.lastInsertRowid],
    ['Bahasa Indonesia', 'BIN-01', 75, null],
    ['Bahasa Inggris', 'BIG-01', 75, guru3.lastInsertRowid],
    ['Fisika', 'FIS-01', 70, guru2.lastInsertRowid],
    ['Kimia', 'KIM-01', 70, null],
    ['Biologi', 'BIO-01', 70, null],
    ['Sejarah Indonesia', 'SEJ-01', 75, null],
    ['Pendidikan Agama', 'PAI-01', 75, null],
    ['PJOK', 'PJK-01', 75, null],
    ['Seni Budaya', 'SBD-01', 75, null],
  ];

  mapels.forEach(m => {
    mapelStmt.run(m[0], m[1], m[2], m[3], 1);
  });

  // Insert sample nilai for siswa ID 4 (rizky.pratama)
  const nilaiStmt = db.prepare(`INSERT INTO nilai (siswa_id, mapel_id, semester, tahun_ajaran, nilai_pengetahuan, nilai_keterampilan, predikat, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
  const sampleNilai = [
    [4, 1, 'Ganjil', '2024/2025', 85, 88, 'A', 'published'],
    [4, 2, 'Ganjil', '2024/2025', 92, 90, 'A', 'published'],
    [4, 3, 'Ganjil', '2024/2025', 88, 82, 'A', 'published'],
    [4, 4, 'Ganjil', '2024/2025', 78, 75, 'B', 'published'],
    [4, 5, 'Ganjil', '2024/2025', 82, 80, 'B', 'published'],
    [4, 6, 'Ganjil', '2024/2025', 90, 85, 'A', 'published'],
    [4, 7, 'Ganjil', '2024/2025', 85, 85, 'A', 'published'],
    [4, 8, 'Ganjil', '2024/2025', 95, 95, 'A', 'published'],
    [4, 9, 'Ganjil', '2024/2025', 88, 90, 'A', 'published'],
    [4, 10, 'Ganjil', '2024/2025', 80, 82, 'B', 'published'],
  ];

  sampleNilai.forEach(n => nilaiStmt.run(...n));

  // Insert kehadiran
  db.prepare(`INSERT INTO kehadiran (siswa_id, semester, tahun_ajaran, sakit, izin, alpa) VALUES (?, ?, ?, ?, ?, ?)`)
    .run(4, 'Ganjil', '2024/2025', 1, 0, 0);

  // Insert ekstrakurikuler
  db.prepare(`INSERT INTO ekstrakurikuler (siswa_id, nama_ekskul, nilai, keterangan, semester, tahun_ajaran) VALUES (?, ?, ?, ?, ?, ?)`)
    .run(4, 'Basketball Club', 'A', 'Sangat Aktif', 'Ganjil', '2024/2025');
  db.prepare(`INSERT INTO ekstrakurikuler (siswa_id, nama_ekskul, nilai, keterangan, semester, tahun_ajaran) VALUES (?, ?, ?, ?, ?, ?)`)
    .run(4, 'Robotics', 'B', 'Aktif', 'Ganjil', '2024/2025');

  // Insert CV data
  db.prepare(`INSERT INTO cv_data (siswa_id, template, target_pekerjaan, tentang_saya, pengalaman_judul, pengalaman_desc, organisasi) VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .run(4, 'modern', 'Future Data Scientist', 'Siswa kelas 12 yang bersemangat dalam dunia teknologi dan data. Memiliki ketertarikan khusus pada pemrograman dan analisis statistik.', 'Ketua Divisi Teknik Robotik', 'Memimpin tim dalam merancang dan memprogram robot untuk kompetisi nasional. Berhasil membawa tim meraih medali perak.', 'OSIS, Robotik Club');

  console.log('Database seeded successfully!');
}

module.exports = db;
