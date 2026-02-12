/**
 * Checks if the file is a HEIC/HEIF image and converts it to JPEG.
 * If it's not a HEIC image, returns the original file.
 */
export async function processImageFile(file: File): Promise<File> {
    // Check for HEIC file type (case insensitive)
    if (
        file.type.toLowerCase() === "image/heic" ||
        file.type.toLowerCase() === "image/heif" ||
        file.name.toLowerCase().endsWith(".heic") ||
        file.name.toLowerCase().endsWith(".heif")
    ) {
        try {
            // Dynamic import to avoid SSR issues with 'window is not defined'
            const heic2any = (await import("heic2any")).default;

            // Convert to blob (JPEG)
            const convertedBlob = await heic2any({
                blob: file,
                toType: "image/jpeg",
                quality: 0.92, // High quality JPEG
            });

            // Handle case where heic2any returns an array of blobs (for multi-image HEIC)
            // We take the first one
            const blob = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;

            // Create a new File object
            // Replace extension with .jpg
            const newName = file.name.replace(/\.(heic|heif)$/i, ".jpg");

            return new File([blob], newName, {
                type: "image/jpeg",
                lastModified: Date.now(),
            });
        } catch (error) {
            console.error("Error converting HEIC image:", error);
            // Fallback to original file if conversion fails, 
            // though downstream components might not handle it.
            return file;
        }
    }

    return file;
}
