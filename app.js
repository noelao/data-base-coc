const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const app = express();
const port = 3000;

// Middleware untuk parsing body form
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
// Serve folder image secara static agar bisa diakses via URL
app.use('/image', express.static(path.join(__dirname, 'image')));

// Set EJS sebagai view engine
app.set('view engine', 'ejs');

// Pastikan folder penyimpanan ada saat startup
const dirs = [path.join(__dirname, 'image'), path.join(__dirname, 'base')];
dirs.forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Konfigurasi Multer untuk penyimpanan file
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = path.join(__dirname, 'image');
    // Buat folder image jika belum ada
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    // Nama file unik: timestamp + angka acak + ekstensi asli
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

// Filter agar hanya file gambar yang diterima
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Hanya file gambar (jpg, jpeg, png, gif, webp) yang diperbolehkan!'));
  }
};

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // Batas ukuran file 5MB
  fileFilter: fileFilter
});

app.get('/', (req, res) => {
  res.render('index');
});

app.post('/', upload.single('image'), (req, res) => {
  try {
    const { link, th } = req.body;
    let base_type = req.body.base_type;

    // Normalize base_type to always be an array
    if (!base_type) {
      base_type = [];
    } else if (!Array.isArray(base_type)) {
      base_type = [base_type];
    }

    const authorName = req.body['author[name]'] || (req.body.author && req.body.author.name) || 'Unknown';
    const authorTag = req.body['author[tag]'] || (req.body.author && req.body.author.tag) || '';

    // Validasi Input
    if (!link || !th || !req.file) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(400).json({ message: "Link, TH, dan Gambar wajib diisi!" });
    }

    const baseDir = path.join(__dirname, 'base');
    if (!fs.existsSync(baseDir)) {
      fs.mkdirSync(baseDir, { recursive: true });
    }

    const filePath = path.join(baseDir, `baseth${th}.json`);
    let data = [];

    if (fs.existsSync(filePath)) {
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      try {
        data = JSON.parse(fileContent);
      } catch (err) {
        console.error("Error parsing JSON (membuat file baru):", err);
        data = [];
      }
    }

    const newId = data.length > 0 ? data[data.length - 1].id + 1 : 1;

    const newData = {
      id: newId,
      link: link,
      th: parseInt(th),
      base_type: base_type, // Field baru ditambahkan di sini
      image: req.file ? req.file.filename : null,
      author: {
        name: authorName,
        tag: authorTag
      }
    };

    data.push(newData);

    fs.writeFileSync(filePath, JSON.stringify(data, null, 4));

    res.json({
      message: "Selamat upload berhasil",
      data: newData
    });
  } catch (error) {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    console.error("Error saat memproses request:", error);
    res.status(500).json({ message: "Terjadi kesalahan pada server", error: error.message });
  }
});

// Middleware Error Handling Global (Menangkap error Multer dll)
app.use((err, req, res, next) => {
  console.error("Global Error Handler:", err);
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ message: "Gagal Upload: " + err.message });
  }
  res.status(500).json({ message: "Internal Server Error", error: err.message });
});

app.listen(port, () => {
  console.log(`Aplikasi berjalan di http://localhost:${port}`);
});