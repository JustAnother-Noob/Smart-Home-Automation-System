const multer = require('multer');

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
    
    if (/^image\
        cb(null, true);
    } else {
        cb(new Error('Only image files allowed!'), false);
    }
};

const limits = {
    fileSize: 10 * 1024 * 1024 
};

const uploadMiddleware = multer({ 
    storage, 
    fileFilter,
    limits 
});

const prepareImageForMongoDB = (req, res, next) => {
    if (!req.file) return next();

    req.fileData = {
        filename: req.file.originalname,
        contentType: req.file.mimetype,
        imageData: req.file.buffer,
        uploadDate: new Date()
    };
    
    next();
};

module.exports = uploadMiddleware;

module.exports.prepareImageForMongoDB = prepareImageForMongoDB;