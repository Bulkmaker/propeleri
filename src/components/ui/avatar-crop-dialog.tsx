"use client";

import { useCallback, useState } from "react";
import Cropper from "react-easy-crop";
import type { Area } from "react-easy-crop";
import imageCompression from "browser-image-compression";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, ZoomIn, ZoomOut, Check, X } from "lucide-react";

/**
 * Draw the cropped area onto a canvas and return a compressed Blob.
 */
async function getCroppedBlob(
    imageSrc: string,
    pixelCrop: Area
): Promise<Blob> {
    const image = await createImage(imageSrc);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;

    canvas.width = pixelCrop.width;
    canvas.height = pixelCrop.height;

    ctx.drawImage(
        image,
        pixelCrop.x,
        pixelCrop.y,
        pixelCrop.width,
        pixelCrop.height,
        0,
        0,
        pixelCrop.width,
        pixelCrop.height
    );

    // Convert canvas to blob
    const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
            (b) => (b ? resolve(b) : reject(new Error("Canvas toBlob failed"))),
            "image/jpeg",
            0.92
        );
    });

    // Compress with browser-image-compression
    const file = new File([blob], "avatar.jpg", { type: "image/jpeg" });
    const compressed = await imageCompression(file, {
        maxSizeMB: 0.2,
        maxWidthOrHeight: 400,
        useWebWorker: true,
    });

    return compressed;
}

function createImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.addEventListener("load", () => resolve(img));
        img.addEventListener("error", (e) => reject(e));
        img.setAttribute("crossOrigin", "anonymous");
        img.src = url;
    });
}

interface AvatarCropDialogProps {
    open: boolean;
    imageSrc: string | null;
    onClose: () => void;
    onConfirm: (blob: Blob) => void | Promise<void>;
    title?: string;
    saveLabel?: string;
    cancelLabel?: string;
}

export function AvatarCropDialog({
    open,
    imageSrc,
    onClose,
    onConfirm,
    title = "Crop avatar",
    saveLabel = "Save",
    cancelLabel = "Cancel",
}: AvatarCropDialogProps) {
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
    const [processing, setProcessing] = useState(false);

    const onCropComplete = useCallback((_: Area, areaPixels: Area) => {
        setCroppedAreaPixels(areaPixels);
    }, []);

    const handleConfirm = useCallback(async () => {
        if (!imageSrc || !croppedAreaPixels) return;
        setProcessing(true);
        try {
            const blob = await getCroppedBlob(imageSrc, croppedAreaPixels);
            await onConfirm(blob);
        } finally {
            setProcessing(false);
        }
    }, [imageSrc, croppedAreaPixels, onConfirm]);

    // Reset state when dialog opens/closes
    const handleOpenChange = useCallback(
        (isOpen: boolean) => {
            if (!isOpen) {
                setCrop({ x: 0, y: 0 });
                setZoom(1);
                setCroppedAreaPixels(null);
                onClose();
            }
        },
        [onClose]
    );

    if (!imageSrc) return null;

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="bg-card border-border sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                </DialogHeader>

                {/* Cropper area */}
                <div className="relative w-full aspect-square bg-black/90 rounded-lg overflow-hidden">
                    <Cropper
                        image={imageSrc}
                        crop={crop}
                        zoom={zoom}
                        aspect={1}
                        cropShape="round"
                        showGrid={false}
                        onCropChange={setCrop}
                        onCropComplete={onCropComplete}
                        onZoomChange={setZoom}
                        minZoom={1}
                        maxZoom={4}
                    />
                </div>

                {/* Zoom slider */}
                <div className="flex items-center gap-3 px-2">
                    <ZoomOut className="h-4 w-4 text-muted-foreground shrink-0" />
                    <input
                        type="range"
                        min={1}
                        max={4}
                        step={0.05}
                        value={zoom}
                        onChange={(e) => setZoom(Number(e.target.value))}
                        className="flex-1 h-2 accent-primary cursor-pointer"
                        aria-label="Zoom"
                    />
                    <ZoomIn className="h-4 w-4 text-muted-foreground shrink-0" />
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-2">
                    <Button
                        variant="outline"
                        onClick={() => handleOpenChange(false)}
                        disabled={processing}
                    >
                        <X className="mr-2 h-4 w-4" />
                        {cancelLabel}
                    </Button>
                    <Button
                        className="bg-primary"
                        onClick={handleConfirm}
                        disabled={processing || !croppedAreaPixels}
                    >
                        {processing ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <Check className="mr-2 h-4 w-4" />
                        )}
                        {saveLabel}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
