const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;

// Configure storage for different media types
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    let uploadPath;
    
    if (file.fieldname === 'image') {
      uploadPath = 'uploads/media/images';
    } else if (file.fieldname === 'file') {
      uploadPath = 'uploads/media/files';
    } else if (file.fieldname === 'voice') {
      uploadPath = 'uploads/media/voice';
    } else {
      uploadPath = 'uploads/media/other';
    }
    
    // Create directory if it doesn't exist
    try {
      await fs.mkdir(uploadPath, { recursive: true });
    } catch (err) {
      console.error('Error creating directory:', err);
    }
    
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// File filter for images
const imageFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);
  
  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Only image files (JPEG, JPG, PNG, GIF) are allowed'));
  }
};

// File filter for documents
const fileFilter = (req, file, cb) => {
  const allowedTypes = /pdf|doc|docx|txt|xls|xlsx/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  
  if (extname) {
    return cb(null, true);
  } else {
    cb(new Error('Only document files (PDF, DOC, DOCX, TXT, XLS, XLSX) are allowed'));
  }
};

// File filter for voice messages
const voiceFilter = (req, file, cb) => {
  const allowedTypes = /m4a|mp3|wav|ogg|webm/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = /audio/.test(file.mimetype);
  
  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Only audio files (M4A, MP3, WAV, OGG, WEBM) are allowed'));
  }
};

// Configure multer for different upload types
const uploadImage = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: imageFilter
}).single('image');

const uploadFile = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: fileFilter
}).single('file');

const uploadVoice = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB for voice (5 min at high quality)
  fileFilter: voiceFilter
}).single('voice');

// Upload image
router.post('/upload/image', (req, res) => {
  uploadImage(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'File size too large. Maximum size is 5MB' });
      }
      return res.status(400).json({ error: err.message });
    } else if (err) {
      return res.status(400).json({ error: err.message });
    }
    
    if (!req.file) {
      return res.status(400).json({ error: 'No image file uploaded' });
    }
    
    // Return full URL with protocol and host
    const protocol = req.protocol;
    const host = req.get('host');
    const fileUrl = `${protocol}://${host}/api/media/${req.file.filename}`;
    
    res.json({
      success: true,
      media_url: fileUrl,
      media_type: req.file.mimetype,
      media_size: req.file.size,
      filename: req.file.filename,
      original_name: req.file.originalname
    });
  });
});

// Upload document/file
router.post('/upload/file', (req, res) => {
  uploadFile(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'File size too large. Maximum size is 10MB' });
      }
      return res.status(400).json({ error: err.message });
    } else if (err) {
      return res.status(400).json({ error: err.message });
    }
    
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    // Return full URL with protocol and host
    const protocol = req.protocol;
    const host = req.get('host');
    const fileUrl = `${protocol}://${host}/api/media/${req.file.filename}`;
    
    res.json({
      success: true,
      media_url: fileUrl,
      media_type: req.file.mimetype,
      media_size: req.file.size,
      filename: req.file.filename,
      original_name: req.file.originalname
    });
  });
});

// Upload voice message
router.post('/upload/voice', (req, res) => {
  uploadVoice(req, res, async (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'File size too large. Maximum size is 10MB' });
      }
      return res.status(400).json({ error: err.message });
    } else if (err) {
      return res.status(400).json({ error: err.message });
    }
    
    if (!req.file) {
      return res.status(400).json({ error: 'No voice file uploaded' });
    }
    
    // Get audio duration (simplified - in production use a library like fluent-ffmpeg)
    const duration = req.body.duration || null; // Client should send duration
    
    // Return full URL with protocol and host
    const protocol = req.protocol;
    const host = req.get('host');
    const fileUrl = `${protocol}://${host}/api/media/${req.file.filename}`;
    
    res.json({
      success: true,
      media_url: fileUrl,
      media_type: req.file.mimetype,
      media_size: req.file.size,
      duration: duration,
      filename: req.file.filename,
      original_name: req.file.originalname
    });
  });
});

// Get/Download media file
router.get('/media/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    
    // Security: Prevent directory traversal
    if (filename.includes('..') || filename.includes('/')) {
      return res.status(400).json({ error: 'Invalid filename' });
    }
    
    // Search in all media directories
    const directories = [
      'uploads/media/images',
      'uploads/media/files',
      'uploads/media/voice',
      'uploads/media/other'
    ];
    
    let filePath = null;
    for (const dir of directories) {
      const testPath = path.join(dir, filename);
      try {
        await fs.access(testPath);
        filePath = testPath;
        break;
      } catch (err) {
        continue;
      }
    }
    
    if (!filePath) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    // Get file stats
    const stats = await fs.stat(filePath);
    const ext = path.extname(filename).toLowerCase();
    
    // Set appropriate content type
    let contentType = 'application/octet-stream';
    if (['.jpg', '.jpeg', '.png', '.gif'].includes(ext)) {
      contentType = `image/${ext.substring(1)}`;
    } else if (['.mp3', '.m4a', '.wav', '.ogg', '.webm'].includes(ext)) {
      contentType = `audio/${ext.substring(1)}`;
    } else if (ext === '.pdf') {
      contentType = 'application/pdf';
    } else if (['.doc', '.docx'].includes(ext)) {
      contentType = 'application/msword';
    }
    
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', stats.size);
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    // For files (not images/audio), add content-disposition to trigger download
    if (!contentType.startsWith('image/') && !contentType.startsWith('audio/')) {
      const originalName = req.query.name || req.file?.originalname || filename;
      res.setHeader('Content-Disposition', `attachment; filename="${originalName}"`);
    }
    
    // For audio, support range requests for streaming
    if (contentType.startsWith('audio/')) {
      const range = req.headers.range;
      if (range) {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : stats.size - 1;
        const chunksize = (end - start) + 1;
        
        res.status(206);
        res.setHeader('Content-Range', `bytes ${start}-${end}/${stats.size}`);
        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('Content-Length', chunksize);
        
        const stream = require('fs').createReadStream(filePath, { start, end });
        stream.pipe(res);
        return;
      }
    }
    
    // Send file
    res.sendFile(path.resolve(filePath));
    
  } catch (error) {
    console.error('Error serving media:', error);
    res.status(500).json({ error: 'Error serving media file' });
  }
});

// Get voice message (alias for streaming)
router.get('/voice/:filename', (req, res) => {
  req.url = `/api/media/${req.params.filename}`;
  router.handle(req, res);
});

module.exports = router;
