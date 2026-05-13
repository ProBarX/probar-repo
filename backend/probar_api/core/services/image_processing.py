from __future__ import annotations

from io import BytesIO
from pathlib import Path
from typing import Literal

from django.core.exceptions import ValidationError
from django.core.files.base import ContentFile
from PIL import Image, ImageOps, UnidentifiedImageError


PROFILE_IMAGE_SIZE = (900, 900)
DRINK_IMAGE_SIZE = (900, 900)
JPEG_QUALITY = 90

FitMode = Literal["cover", "contain"]


def should_process_image_field(instance, field_name: str, update_fields=None) -> bool:
    if update_fields is not None and field_name not in set(update_fields):
        return False

    field_file = getattr(instance, field_name, None)
    return bool(field_file) and not getattr(field_file, "_committed", True)


def normalize_uncommitted_image_field(
    instance,
    field_name: str,
    *,
    size: tuple[int, int],
    fit: FitMode = "cover",
) -> bool:
    field_file = getattr(instance, field_name, None)
    if not field_file or getattr(field_file, "_committed", True):
        return False

    content, filename = normalize_image_file(
        field_file.file,
        field_file.name,
        size=size,
        fit=fit,
    )
    field_file.save(filename, content, save=False)
    return True


def normalize_committed_image_field(
    instance,
    field_name: str,
    *,
    size: tuple[int, int],
    fit: FitMode = "cover",
) -> bool:
    field_file = getattr(instance, field_name, None)
    if not field_file:
        return False

    field_file.open("rb")
    try:
        content, filename = normalize_image_file(
            field_file.file,
            field_file.name,
            size=size,
            fit=fit,
        )
    finally:
        field_file.close()

    field_file.save(filename, content, save=False)
    instance.save(update_fields=[field_name, "atualizado_em"])
    return True


def image_field_is_normalized(field_file, *, size: tuple[int, int]) -> bool:
    if not field_file:
        return False

    field_file.open("rb")
    try:
        with Image.open(field_file.file) as image:
            return image.size == size and image.format == "JPEG"
    finally:
        field_file.close()


def normalize_image_file(
    file_obj,
    original_name: str,
    *,
    size: tuple[int, int],
    fit: FitMode = "cover",
) -> tuple[ContentFile, str]:
    try:
        file_obj.seek(0)
    except (AttributeError, OSError):
        pass

    try:
        with Image.open(file_obj) as image:
            image = ImageOps.exif_transpose(image)
            image = _convert_to_rgb(image)

            if fit == "cover":
                image = ImageOps.fit(
                    image,
                    size,
                    method=Image.Resampling.LANCZOS,
                    centering=(0.5, 0.5),
                )
            elif fit == "contain":
                image = _contain(image, size)
            else:
                raise ValueError(f"Unsupported image fit mode: {fit}")

            buffer = BytesIO()
            image.save(
                buffer,
                format="JPEG",
                quality=JPEG_QUALITY,
                optimize=True,
                progressive=True,
            )
    except UnidentifiedImageError as exc:
        raise ValidationError("Arquivo de imagem invalido.") from exc

    filename = _jpeg_filename(original_name)
    return ContentFile(buffer.getvalue()), filename


def _convert_to_rgb(image: Image.Image) -> Image.Image:
    has_alpha = image.mode in ("RGBA", "LA") or (
        image.mode == "P" and "transparency" in image.info
    )

    if has_alpha:
        rgba = image.convert("RGBA")
        background = Image.new("RGBA", rgba.size, (255, 255, 255, 255))
        background.alpha_composite(rgba)
        return background.convert("RGB")

    if image.mode != "RGB":
        return image.convert("RGB")

    return image


def _contain(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    contained = image.copy()
    contained.thumbnail(size, Image.Resampling.LANCZOS)

    canvas = Image.new("RGB", size, (255, 255, 255))
    x = (size[0] - contained.width) // 2
    y = (size[1] - contained.height) // 2
    canvas.paste(contained, (x, y))
    return canvas


def _jpeg_filename(original_name: str) -> str:
    stem = Path(original_name).stem or "image"
    return f"{stem}.jpg"
