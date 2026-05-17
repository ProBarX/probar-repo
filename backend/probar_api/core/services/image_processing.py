from __future__ import annotations

from io import BytesIO
from pathlib import Path
from typing import Literal

from django.core.exceptions import ValidationError
from django.core.files.base import ContentFile
from PIL import Image, ImageChops, ImageOps, UnidentifiedImageError


PROFILE_IMAGE_SIZE = (900, 900)
DRINK_IMAGE_SIZE = (900, 600)
JPEG_QUALITY = 90
BORDER_TRIM_THRESHOLD = 12
NEAR_WHITE_THRESHOLD = 245

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
    trim_uniform_border: bool = False,
) -> bool:
    field_file = getattr(instance, field_name, None)
    if not field_file or getattr(field_file, "_committed", True):
        return False

    content, filename = normalize_image_file(
        field_file.file,
        field_file.name,
        size=size,
        fit=fit,
        trim_uniform_border=trim_uniform_border,
    )
    field_file.save(filename, content, save=False)
    return True


def normalize_committed_image_field(
    instance,
    field_name: str,
    *,
    size: tuple[int, int],
    fit: FitMode = "cover",
    trim_uniform_border: bool = False,
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
            trim_uniform_border=trim_uniform_border,
        )
    finally:
        field_file.close()

    field_file.save(filename, content, save=False)
    instance.save(update_fields=[field_name, "atualizado_em"])
    return True


def image_field_is_normalized(
    field_file,
    *,
    size: tuple[int, int],
    min_content_ratio: float | None = None,
) -> bool:
    if not field_file:
        return False

    field_file.open("rb")
    try:
        with Image.open(field_file.file) as image:
            if image.size != size or image.format != "JPEG":
                return False

            if min_content_ratio is None:
                return True

            image = _convert_to_rgb(image)
            content_ratio = _visible_content_ratio(image)
            return content_ratio is None or content_ratio >= min_content_ratio
    finally:
        field_file.close()


def normalize_image_file(
    file_obj,
    original_name: str,
    *,
    size: tuple[int, int],
    fit: FitMode = "cover",
    trim_uniform_border: bool = False,
) -> tuple[ContentFile, str]:
    try:
        file_obj.seek(0)
    except (AttributeError, OSError):
        pass

    try:
        with Image.open(file_obj) as image:
            image = ImageOps.exif_transpose(image)
            image = _convert_to_rgb(image)

            if trim_uniform_border:
                image = _trim_uniform_border(image)

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


def _trim_uniform_border(image: Image.Image) -> Image.Image:
    bbox = _visible_content_bbox(image)
    if not bbox:
        return image

    if bbox == (0, 0, image.width, image.height):
        return image

    return image.crop(bbox)


def _visible_content_ratio(image: Image.Image) -> float | None:
    bbox = _visible_content_bbox(image)
    if not bbox:
        return None

    visible_area = (bbox[2] - bbox[0]) * (bbox[3] - bbox[1])
    return visible_area / (image.width * image.height)


def _visible_content_bbox(image: Image.Image):
    background_color = image.getpixel((0, 0))
    if not _is_near_white(background_color):
        return (0, 0, image.width, image.height)

    background = Image.new("RGB", image.size, background_color)
    diff = ImageChops.difference(image, background).convert("L")
    mask = diff.point(lambda value: 255 if value > BORDER_TRIM_THRESHOLD else 0)
    return mask.getbbox()


def _is_near_white(color: tuple[int, int, int]) -> bool:
    return all(channel >= NEAR_WHITE_THRESHOLD for channel in color)


def _jpeg_filename(original_name: str) -> str:
    stem = Path(original_name).stem or "image"
    return f"{stem}.jpg"
