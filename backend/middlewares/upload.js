import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = new CloudinaryStorage({
    cloudinary,
    params: {
        folder: 'devconnect/posts', // Folder in Cloudinary
        allowed_formats: ['jpg', 'png', 'jpeg', 'gif'], // Allowed file formats
        // transformation: [{ width: 500, height: 500, crop: 'limit' }] // Resize images to a maximum of 500x500 pixels
    }
})

const upload = multer({
    storage,
    limits: { fileSize: 2 * 1024 * 1024 } // Limit file size to 2MB
});

// Middleware to handle file upload errors
const handleUploadErrors = (err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        // Multer-specific errors (e.g., file limit exceeded)
        return res.status(400).json({
            message: err.code === 'LIMIT_UNEXPECTED_FILE'
                ? "Too many files: max 3 allowed"
                : err.message
        });
    }
    else if (err) {
        // An unknown error occurred when uploading.
        return res.status(500).json({ 
            message: "Failed to upload.",
            error: process.env.NODE_ENV === 'development' ? err.message : "An error occurred while uploading the file."
         });
    }
    next();
}

export { upload, handleUploadErrors };
