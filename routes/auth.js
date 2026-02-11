var express = require('express');
var router = express.Router();
var bcrypt = require('bcryptjs');
var db = require('../config/database');

/* GET login page */
router.get('/login', function(req, res) {
  if (req.session && req.session.user) {
    var role = req.session.user.role;
    if (role === 'siswa') return res.redirect('/siswa/dashboard');
    if (role === 'guru') return res.redirect('/guru/dashboard');
    if (role === 'admin') return res.redirect('/admin/dashboard');
  }

  var selectedRole = req.query.role || '';
  res.render('login', {
    title: 'Login',
    error: null,
    username: '',
    selectedRole: selectedRole
  });
});

/* POST login */
router.post('/login', function(req, res) {
  var username = req.body.username;
  var password = req.body.password;
  var role = req.body.role;

  if (!username || !password || !role) {
    return res.render('login', {
      title: 'Login',
      error: 'Semua field harus diisi termasuk role.',
      username: username || '',
      selectedRole: role || ''
    });
  }

  var user = db.prepare('SELECT * FROM users WHERE username = ? AND role = ?').get(username, role);

  if (!user) {
    return res.render('login', {
      title: 'Login',
      error: 'Username atau role tidak ditemukan.',
      username: username,
      selectedRole: role
    });
  }

  var validPassword = bcrypt.compareSync(password, user.password);

  if (!validPassword) {
    return res.render('login', {
      title: 'Login',
      error: 'Password salah. Silakan coba lagi.',
      username: username,
      selectedRole: role
    });
  }

  // Set session
  req.session.user = {
    id: user.id,
    username: user.username,
    role: user.role,
    nama_lengkap: user.nama_lengkap,
    email: user.email,
    foto: user.foto
  };

  // Log
  db.prepare('INSERT INTO system_log (user_id, aksi, detail) VALUES (?, ?, ?)')
    .run(user.id, 'Login', user.nama_lengkap + ' (' + user.role + ') berhasil login.');

  // Redirect based on role
  if (user.role === 'siswa') return res.redirect('/siswa/dashboard');
  if (user.role === 'guru') return res.redirect('/guru/dashboard');
  if (user.role === 'admin') return res.redirect('/admin/dashboard');

  res.redirect('/');
});

/* Logout */
router.get('/logout', function(req, res) {
  if (req.session.user) {
    db.prepare('INSERT INTO system_log (user_id, aksi, detail) VALUES (?, ?, ?)')
      .run(req.session.user.id, 'Logout', req.session.user.nama_lengkap + ' logout.');
  }
  req.session.destroy(function() {
    res.redirect('/');
  });
});

module.exports = router;
