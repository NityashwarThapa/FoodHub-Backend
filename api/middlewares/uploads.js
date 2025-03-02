const multer = require("multer");
const fs = require('fs')

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        let fileDestination = 'public/uploads/';
        if (!fs.existsSync(fileDestination)) {
            fs.mkdirSync(fileDestination, { recursive: true });
            cb(null, fileDestination);
        } else cb(null, fileDestination);
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + file.originalname);
    }
});

const fileFilter = function (req, file, cb) {
    if (
        !file.originalname.match(
          /\.(jpg|jpeg|png|svg|JPG|JPEG|PNG|SVG)$/
        )
      ) {
        return cb(new Error('You can only upload an image'), false);
      }

    cb(null, true);
};

const upload = multer(
    {
        storage: storage,
        fileFilter: fileFilter
    }
);

module.exports = upload;